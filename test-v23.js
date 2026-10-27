import assert from 'node:assert/strict';
import { agentRuns, configureHarness, dumpRedis, harnessFaults, makeRequest, redisCommand, seedRedis, worker } from './test/harness.js';
import plays from './plays.json' with { type: 'json' };

const iso = () => new Date().toISOString();
const check = (name, fn) => { fn(); console.log(`PASS ${name}`); };
const d = 'v23.behavior.chatpay';
const started = await (await makeRequest('POST', '/start', { domain: d, brand: 'V23', email: 'v23@example.com' })).json();
assert.ok(started.token);
seedRedis(`swarm:prods:${d}`, [{ id: 1, name: 'Trial', cents: 9700, deliver: '/ok' }]);
const call = (method, path, body) => makeRequest(method, path, body);
const auth = body => ({ token: started.token, ...body });

const ev = await call('POST', '/api/swarm-event', auth({ type: 'whatsapp_intent', channel: 'api', user: 'lead-1', text: 'quero comprar', lead_id: 'lead-1' }));
check('V23 event accepted', () => assert.equal(ev.status, 200));
await worker.scheduled({ cron: '* * * * *' }, { AI: null }, {});
const arc = await (await call('GET', '/api/v23/arc?token=' + encodeURIComponent(started.token) + '&lead_id=lead-1')).json();
check('7-stage lead arc exposed', () => assert.equal(arc.stages.length, 7));
check('arc uses requested stage names and key contract', () => {
  assert.deepEqual(arc.stages, ['OPEN', 'QUALIFY', 'VALUE', 'PROOF', 'CLOSE', 'RECOVER', 'WIN']);
  assert.ok(dumpRedis(`lead:${d}:lead-1:arc`).hashes.length > 0);
});
check('lead memory persisted', () => assert.ok(arc.memory.length > 0));
check('plays.json preserves legacy plays and adds LastMileClose', () => assert.deepEqual(plays.slice(0, 12).map(play => play.id), ['MirrorOpener', 'LabelEmpathy', 'CalibratedQuestion', 'SocialProofSpecific', 'AnchorValue', 'LossAversion', 'MicroYes', 'RiskReversal', 'ReciprocityGift', 'ScarcityHonest', 'UnityLanguage', 'AuthorityProof']) && assert.ok(plays.some(play => play.id === 'LastMileClose')));

const play = await (await call('POST', '/api/v23/select-play', auth({ lead_id: 'lead-1', amount: 9700 }))).json();
check('Thompson play selected', () => assert.ok(play.play && play.play.id));
const reward = await (await call('POST', '/api/v23/reward', auth({ play_id: play.play.id, paid: true }))).json();
check('play reward persisted', () => assert.ok(Number(reward.stats.success) >= 1));
const touch = await (await call('POST', '/api/v23/touches', auth({ lead_id: 'lead-1', channel: 'api' }))).json();
check('touch cadence stores play', () => assert.ok(touch.play));
for (let i = 0; i < 5; i += 1) await call('POST', '/api/v23/touches', { token: started.token, lead_id: 'touch-lead', channel: 'api' });
check('touch cadence is scheduled for five intervals', () => {
  const delays = dumpRedis(`lead:${d}:touch-lead:touches`).lists[0][1].map(item => JSON.parse(item).delay_ms).sort((a, b) => a - b);
  assert.deepEqual(delays, [600000, 3600000, 86400000, 259200000, 604800000]);
  assert.equal(dumpRedis(`lead:${d}:touch-lead:touch_schedule`).sorted[0][1].size, 5);
});

const scout = await (await call('POST', '/api/swarm-event', auth({ type: 'whatsapp_intent', channel: 'api', user: 'lead-2', text: 'mensagem totalmente desconhecida', lead_id: 'lead-2' })));
assert.equal(scout.status, 200);
await worker.scheduled({ cron: '* * * * *' }, { AI: null }, {});
const scoutData = await (await call('GET', '/api/v23/scout?token=' + encodeURIComponent(started.token))).json();
check('Scout captures unknown and reports rate', () => assert.ok(Array.isArray(scoutData.items) && 'unknown_rate' in scoutData));
const scoutItem = scoutData.items[0];
if (scoutItem) {
  const approved = await (await call('POST', '/api/v23/scout', auth({ action: 'approve', id: scoutItem.id }))).json();
  check('Scout approval is explicit and recorded', () => assert.equal(approved.item.status, 'approved'));
}
const roi = await (await call('GET', '/api/v23/roi?token=' + encodeURIComponent(started.token))).json();
check('ROI endpoint returns attribution by play', () => assert.ok('attributed_revenue_cents' in roi && 'by_play' in roi));

const c1 = 'v23.c1.chatpay';
const c1Started = await (await makeRequest('POST', '/start', { domain: c1, brand: 'C1', email: 'c1@example.com' })).json();
const c1Call = (method, path, body) => makeRequest(method, path, body);
const c1Auth = body => ({ token: c1Started.token, ...body });
const flush = async () => { for (let i = 0; i < 5; i += 1) await worker.scheduled({ cron: '* * * * *' }, { AI: null }, {}); };

await Promise.all(Array.from({ length: 50 }, () => c1Call('POST', '/api/swarm-event', c1Auth({ type: 'whatsapp_intent', channel: 'api', user: 'same-user', text: 'quero comprar', lead_id: 'concurrent-lead' }))));
await flush();
const concurrentArc = await (await c1Call('GET', '/api/v23/arc?token=' + encodeURIComponent(c1Started.token) + '&lead_id=concurrent-lead')).json();
check('C1.1 concurrency coalesces 50 same-lead events', () => assert.equal(Number(concurrentArc.arc.turn), 1));
check('C1.1 concurrency executes one classified pipeline', () => assert.equal(Number((dumpRedis(`agent:runs:${c1}`).hashes.find(([key]) => key === `agent:runs:${c1}`) || [])[1]?.get('classifyIntent') || 0), 1));

configureHarness({ redisDelayMs: 5000 });
const timeoutStart = Date.now();
const timeoutResponse = await c1Call('POST', '/api/swarm-event', c1Auth({ type: 'whatsapp_intent', channel: 'api', user: 'timeout-user', text: 'quero comprar', lead_id: 'timeout-lead' }));
const timeoutElapsed = Date.now() - timeoutStart;
configureHarness({ redisDelayMs: 0 });
await new Promise(resolve => setTimeout(resolve, 150));
check('C1.2 Redis timeout returns degraded response under two seconds', () => assert.ok(timeoutElapsed < 2000 && timeoutResponse.status === 200));

configureHarness({ llmStatus: 503 });
await c1Call('POST', '/api/swarm-event', c1Auth({ type: 'whatsapp_intent', channel: 'api', user: 'llm-user', text: 'quero comprar', lead_id: 'llm-lead' }));
await flush();
const llmQueue = (dumpRedis(`swarm:reply-queue:api:${c1}`).lists.find(([key]) => key === `swarm:reply-queue:api:${c1}`) || [])[1] || [];
const llmRuns = (dumpRedis(`agent:runs:${c1}`).hashes.find(([key]) => key === `agent:runs:${c1}`) || [])[1];
configureHarness({ llmStatus: 0 });
check('C1.3 LLM 503 still sends deterministic reply', () => assert.ok(llmQueue.some(raw => JSON.parse(raw).to === 'llm-user' && JSON.parse(raw).text.includes('/pay?d='))));
check('C1.3 LLM fallback increments closer', () => assert.ok(Number(llmRuns?.get('closer') || 0) >= 1));

seedRedis(`swarm:playbook:${c1}`, { webhooks: [{ event: 'payment_confirmed', url: 'https://harness.webhook/c1', secret: 'test' }] });
const charge = await (await c1Call('POST', '/chatpay/charge', { token: c1Started.token, amount: 9.7, demo: true, lead_id: 'webhook-lead' })).json();
configureHarness({ webhookFailures: 2, webhookAttempts: 0, webhookTimes: [] });
await c1Call('GET', '/confirm?key=test-midas-secret&txid=' + encodeURIComponent(charge.txid));
check('C1.4 webhook retries twice then succeeds', () => assert.equal(harnessFaults.webhookAttempts, 3));
check('C1.4 webhook backoff increases', () => assert.ok(harnessFaults.webhookTimes[1] - harnessFaults.webhookTimes[0] >= 40 && harnessFaults.webhookTimes[2] - harnessFaults.webhookTimes[1] >= 80));

redisCommand('HSET', `lead:${c1}:reboot-lead:arc`, 'stage', 'CLOSE', 'turn', '4');
redisCommand('DEL', `lead:${c1}:reboot-lead:stage`);
const rebootArc = await (await c1Call('GET', '/api/v23/arc?token=' + encodeURIComponent(c1Started.token) + '&lead_id=reboot-lead')).json();
check('C1.5 persisted CLOSE arc survives worker-memory reboot boundary', () => assert.equal(rebootArc.arc.stage, 'CLOSE'));

await c1Call('POST', '/api/swarm-event', c1Auth({ type: 'whatsapp_intent', channel: 'api', user: 'cross-user', text: 'não quero mais', lead_id: 'cross-user' }));
await flush();
await c1Call('POST', '/api/swarm-event', c1Auth({ type: 'whatsapp_intent', channel: 'api', user: 'cross-user', text: 'quero comprar', lead_id: 'cross-user' }));
await flush();
const otherDomain = 'v23.other.chatpay';
const otherStarted = await (await makeRequest('POST', '/start', { domain: otherDomain, brand: 'Other', email: 'other@example.com' })).json();
await makeRequest('POST', '/api/swarm-event', { token: otherStarted.token, type: 'whatsapp_intent', channel: 'api', user: 'cross-user', text: 'quero comprar', lead_id: 'cross-user' });
await worker.scheduled({ cron: '* * * * *' }, { AI: null }, {});
check('C1.6 blacklist is isolated by domain', () => assert.equal(redisCommand('SISMEMBER', `swarm:blacklist:${c1}`, 'cross-user').result, 1) && assert.equal(redisCommand('SISMEMBER', `swarm:blacklist:${otherDomain}`, 'cross-user').result, 0));

for (let i = 0; i < 500; i += 1) redisCommand('LPUSH', `swarm:scout:unknown:${c1}`, JSON.stringify({ id: `bulk-${i}`, text: `unknown pattern ${i % 5}`, status: 'pending' }));
const mineStart = Date.now();
const mined = await (await c1Call('POST', '/api/v23/scout', c1Auth({ action: 'mine' }))).json();
check('C1.7 Scout groups 500 unknowns under five seconds', () => assert.ok(Date.now() - mineStart < 5000 && Object.keys(mined.digest.clusters).length <= 5));

redisCommand('DEL', `lead:${c1}:bandit-lead:arc`);
redisCommand('DEL', `play:stats:${c1}:MirrorOpener`);
redisCommand('DEL', `play:stats:${c1}:ReciprocityGift`);
for (let i = 0; i < 100; i += 1) await c1Call('POST', '/api/v23/reward', c1Auth({ play_id: 'MirrorOpener', paid: true }));
let mirrorWins = 0;
for (let i = 0; i < 20; i += 1) {
  const selected = await (await c1Call('POST', '/api/v23/select-play', c1Auth({ lead_id: 'bandit-lead', amount: 9700 }))).json();
  if (selected.play.id === 'MirrorOpener') mirrorWins += 1;
}
check('C1.8 bandit converges to winning MirrorOpener', () => assert.ok(mirrorWins >= 19));

const adversarial = ['só hoje', 'so hoje', 'última chance', 'ultima chance', 'últimas 3 vagas', 'ultimas 3 vagas', 'últimas três vagas', 'ultimas tres vagas', '100% garantido', 'sem risco', 'vai faturar', 'enriquecer rápido', 'resultado garantido', 'vagas limitadas só hoje', 'garanta agora sem risco', 'última chance garantida', 'só hoje sem risco', 'três vagas restantes', '3 vagas restantes', 'fature garantido'];
seedRedis(`swarm:playbook:${c1}`, { replies: { buy: '{link} só hoje' } });
for (let i = 0; i < adversarial.length; i += 1) {
  await c1Call('POST', '/api/swarm-event', c1Auth({ type: 'whatsapp_intent', channel: 'api', user: `judge-${i}`, text: adversarial[i] + ' quero comprar', lead_id: `judge-${i}` }));
}
await flush();
const judgeReplies = (dumpRedis(`swarm:reply-queue:api:${c1}`).lists.find(([key]) => key === `swarm:reply-queue:api:${c1}`) || [])[1] || [];
check('C1.9 honesty judge blocks adversarial scarcity claims', () => assert.ok(judgeReplies.filter(raw => JSON.parse(raw).to && JSON.parse(raw).to.startsWith('judge-') && !JSON.parse(raw).text.match(/só hoje|so hoje|última chance|ultima chance|vagas/i)).length >= 19));

for (let i = 0; i < 2; i += 1) await c1Call('POST', '/api/v23/touches', c1Auth({ lead_id: 'cadence-lead', channel: 'api' }));
await c1Call('POST', '/api/swarm-event', c1Auth({ type: 'whatsapp_intent', channel: 'api', user: 'cadence-user', text: 'não quero mais', lead_id: 'cadence-lead' }));
await flush();
const blockedTouches = await Promise.all([3, 4, 5].map(() => c1Call('POST', '/api/v23/touches', c1Auth({ lead_id: 'cadence-lead', channel: 'api' }))));
const blockedTouchResults = await Promise.all(blockedTouches.map(response => response.json()));
check('C1.10 opt-out stops touches three through five', () => assert.ok(blockedTouchResults.every(result => result.stopped === true)));

  // ===== SDR AGENT (BANT/MEDDIC/SPIN) TESTS =====
  const sdrDom = 'v23.sdr.chatpay';
  const sdrStarted = await (await makeRequest('POST', '/start', { domain: sdrDom, brand: 'SDR', email: 'sdr@example.com' })).json();
  const sdrAuth = body => ({ token: sdrStarted.token, ...body });
  const sdrCall = (method, path, body) => makeRequest(method, path, body);

  // Test 1: enable_qualification gate — qualifyLead runs only when enabled
  seedRedis(`swarm:playbook:${sdrDom}`, { enable_qualification: true, nicho: 'produtos digitais', tom: 'claro', floor: 0, ceiling: 999999, upsell: '', benefits: [], guarantee: 'garantia de 7 dias', llm_provider: 'workers_ai' });
  seedRedis(`swarm:prods:${sdrDom}`, [{ id: 1, name: 'Trial', cents: 9700, deliver: '/ok' }]);

  await sdrCall('POST', '/api/swarm-event', sdrAuth({ type: 'lead', channel: 'telegram', user: 'sdr-lead-1', text: 'quero comprar agora, tenho verba aprovada e sou o dono da empresa', lead_id: 'sdr-lead-1' }));
  await worker.scheduled({ cron: '* * * * *' }, { AI: null }, {});
  const sdrRuns = await agentRuns(sdrDom);
  check('C2.1 SDR runs when enable_qualification=true', () => assert.ok(Number(sdrRuns?.qualifyLead || 0) >= 1));
  const sdrQual = dumpRedis(`swarm:qualification:${sdrDom}`).values.find(([k]) => k.includes('sdr-lead-1'));
  check('C2.1 SDR persists qualification to Redis', () => assert.ok(sdrQual));
  const sdrParsed = sdrQual ? JSON.parse(sdrQual[1]) : null;
  check('C2.1 SDR qualification has BANT/MEDDIC/SPIN scores', () => assert.ok(sdrParsed && sdrParsed.bant && sdrParsed.meddic && sdrParsed.spin && typeof sdrParsed.score === 'number'));
  check('C2.1 SDR regex path qualifies hot lead (>40)', () => assert.ok(sdrParsed?.qualified === true && sdrParsed.score >= 40));

  // Test 2: gate disabled — qualifyLead does NOT run
  const gateDom = 'v23.sdrgate.chatpay';
  const gateStarted = await (await makeRequest('POST', '/start', { domain: gateDom, brand: 'Gate', email: 'gate@example.com' })).json();
  const gateAuth = body => ({ token: gateStarted.token, ...body });
  seedRedis(`swarm:playbook:${gateDom}`, { enable_qualification: false, nicho: 'geral', tom: 'claro', floor: 0, ceiling: 999999, upsell: '', benefits: [], guarantee: 'garantia de 7 dias' });
  seedRedis(`swarm:prods:${gateDom}`, [{ id: 1, name: 'Trial', cents: 9700, deliver: '/ok' }]);
  await makeRequest('POST', '/api/swarm-event', gateAuth({ type: 'lead', channel: 'telegram', user: 'gate-lead-1', text: 'quero comprar agora', lead_id: 'gate-lead-1' }));
  await worker.scheduled({ cron: '* * * * *' }, { AI: null }, {});
  const gateRuns = await agentRuns(gateDom);
  check('C2.2 SDR disabled when enable_qualification=false', () => assert.equal(Number(gateRuns?.qualifyLead || 0), 0));

  // Test 3: LLM-based scoring via DeepSeek R1 (DeepSeek stub returns JSON)
  const llmDom = 'v23.sdrlm.chatpay';
  // Reset global fail counter that may have been incremented by C1.3 LLM 503 test
  redisCommand('SET', 'swarm:llm:fails:default', '0');
  configureHarness({ llmStatus: 0 });
  const llmStarted = await (await makeRequest('POST', '/start', { domain: llmDom, brand: 'LLM', email: 'llm@example.com' })).json();
  const llmAuth = body => ({ token: llmStarted.token, ...body });
  seedRedis(`swarm:playbook:${llmDom}`, { enable_qualification: true, nicho: 'produtos digitais', tom: 'claro', floor: 0, ceiling: 999999, upsell: '', benefits: [], guarantee: 'garantia de 7 dias', llm_provider: 'deepseek_reasoner', llm_key: 'sk-deepseek-test-key' });
  seedRedis(`swarm:prods:${llmDom}`, [{ id: 1, name: 'Premium', cents: 9700, deliver: '/ok' }]);
await makeRequest('POST', '/api/swarm-event', llmAuth({ type: 'lead', channel: 'telegram', user: 'llm-lead-1', text: 'quero comprar agora, sou o diretor e tenho orcamento aprovado de R$ 5000', lead_id: 'llm-lead-1' }));
  await worker.scheduled({ cron: '* min * * *' }, { AI: null }, {});
  const llmQual = dumpRedis(`swarm:qualification:${llmDom}`).values.find(([k]) => k.includes('llm-lead-1'));
  const llmParsed = llmQual ? JSON.parse(llmQual[1]) : null;
  check('C2.3 SDR uses LLM reasoning path when DeepSeek R1 configured', () => assert.ok(llmParsed?.llm_used === true));
  check('C2.3 SDR LLM path returns valid BANT/MEDDIC/SPIN + methodology', () => assert.ok(llmParsed && llmParsed.bant && llmParsed.meddic && llmParsed.spin && typeof llmParsed.methodology === 'string'));

  // Test 4: Cost guard blocks LLM scoring when budget exceeded
  const guardDom = 'v23.sdrguard.chatpay';
  const guardStarted = await (await makeRequest('POST', '/start', { domain: guardDom, brand: 'Guard', email: 'guard@example.com' })).json();
  const guardAuth = body => ({ token: guardStarted.token, ...body });
  seedRedis(`swarm:playbook:${guardDom}`, { enable_qualification: true, nicho: 'produtos digitais', tom: 'claro', floor: 0, ceiling: 999999, upsell: '', benefits: [], guarantee: 'garantia de 7 dias', llm_provider: 'deepseek_reasoner', llm_key: 'sk-deepseek-test-key' });
  seedRedis(`swarm:prods:${guardDom}`, [{ id: 1, name: 'Premium', cents: 9700, deliver: '/ok' }]);
  // Set budget already exceeded: 9700 cents = R$97; threshold = 97 * 0.15 = R$14.55; spent = 100 > 14.55
  const dk = new Date().toISOString().slice(0, 10);
  redisCommand('SET', 'swarm:budget:' + guardDom + ':' + dk, '100');
  await makeRequest('POST', '/api/swarm-event', guardAuth({ type: 'lead', channel: 'telegram', user: 'guard-lead-1', text: 'quero comprar agora, sou diretor', lead_id: 'guard-lead-1' }));
  await worker.scheduled({ cron: '* min * * *' }, { AI: null }, {});
  const guardQual = dumpRedis(`swarm:qualification:${guardDom}`).values.find(([k]) => k.includes('guard-lead-1'));
  const guardParsed = guardQual ? JSON.parse(guardQual[1]) : null;
  check('C2.4 SDR cost guard blocks LLM when budget exceeded', () => assert.ok(guardParsed?.llm_used === false && guardParsed?.methodology === 'cost_guard'));

  // ===== USAGE METRICS ENDPOINT TESTS =====
  const umDom = 'v23.usage.chatpay';
  const umStarted = await (await makeRequest('POST', '/start', { domain: umDom, brand: 'Usage', email: 'usage@example.com' })).json();
  const umAuth = body => ({ token: umStarted.token, ...body });

  // Seed LLM usage data for today
  const todayKey = new Date().toISOString().slice(0, 10);
  redisCommand('HSET', 'swarm:llm:usage:' + umDom + ':' + todayKey, 'tokens_in', '1000', 'tokens_out', '500', 'cost_r$', '0.50', 'calls', '10', 'tokens_deepseek_chat', '1500', 'cost_deepseek_chat', '0.30', 'last_call_at', iso());
  // Seed accumulated usage
  redisCommand('HSET', 'swarm:llm:usage:' + umDom, 'tokens_in', '5000', 'tokens_out', '2500', 'cost_r$', '2.50', 'calls', '50', 'tokens_deepseek_chat', '7500', 'cost_deepseek_chat', '1.50', 'tokens_openai', '2000', 'cost_openai', '1.00', 'last_call_at', iso());
  // Seed agent runs
  redisCommand('HSET', 'agent:runs:' + umDom, 'classifyIntent', '25', 'objectionHandler', '20', 'craftReply', '22', 'proofGenerator', '15', 'timingOptimizer', '18');
  // Seed sales for revenue
  redisCommand('RPUSH', 'swarm:txlog', JSON.stringify({ dom: umDom, cents: 9700, rail: 'pix', ts: iso(), txid: 'tx1', lead_id: 'lead-1' }));
  redisCommand('RPUSH', 'swarm:txlog', JSON.stringify({ dom: umDom, cents: 9700, rail: 'pix', ts: iso(), txid: 'tx2', lead_id: 'lead-2' }));
  // Seed budget
  redisCommand('SET', 'swarm:budget:' + umDom + ':' + todayKey, '5');

  const umResponse = await (await makeRequest('GET', '/api/usage-metrics?token=' + encodeURIComponent(umStarted.token))).json();
  check('C3.1 endpoint returns data', () => assert.ok(umResponse && umResponse.domain === umDom && 'today' in umResponse && 'week' in umResponse && 'month' in umResponse && 'agents' in umResponse && 'revenue_cents' in umResponse && 'budget_used' in umResponse && 'alerts' in umResponse));
  check('C3.1 today metrics populated', () => assert.ok(umResponse.today.tokens_in === 1000 && umResponse.today.tokens_out === 500 && Number(umResponse.today.cost_r$) === 0.5 && umResponse.today.calls === 10));
  check('C3.1 week metrics populated', () => assert.ok(umResponse.week.tokens_in === 5000 && umResponse.week.tokens_out === 2500 && Number(umResponse.week.cost_r$) === 2.5 && umResponse.week.calls === 50));
  check('C3.1 agents populated', () => assert.ok(umResponse.agents.classifyIntent === 25 && umResponse.agents.objectionHandler === 20));
  check('C3.1 revenue and budget', () => assert.ok(umResponse.revenue_cents === 19400 && umResponse.budget_used === 5));
  check('C3.1 by_provider populated', () => assert.ok(umResponse.week.by_provider.deepseek_chat && umResponse.week.by_provider.deepseek_chat.tokens === 7500 && Number(umResponse.week.by_provider.deepseek_chat.cost_r$) === 1.5));

  // Test 2: quota 80% alert
  const alertDom = 'v23.usage.alert.chatpay';
  const alertStarted = await (await makeRequest('POST', '/start', { domain: alertDom, brand: 'Alert', email: 'alert@example.com' })).json();
  const alertAuth = body => ({ token: alertStarted.token, ...body });
  // Seed with 85% of quota (85000 tokens, quota limit is 100000)
  redisCommand('HSET', 'swarm:llm:usage:' + alertDom + ':' + todayKey, 'tokens_in', '60000', 'tokens_out', '25000', 'cost_r$', '1.00', 'calls', '20');
  const alertResponse = await (await makeRequest('GET', '/api/usage-metrics?token=' + encodeURIComponent(alertStarted.token))).json();
  check('C3.2 alert quota_80 triggered at 80%', () => assert.ok(alertResponse.alerts.some(a => a.type === 'quota_80' && a.severity === 'warning')));

  // Test 3: cost >15% revenue alert
  const costAlertDom = 'v23.usage.costal.chatpay';
  const costAlertStarted = await (await makeRequest('POST', '/start', { domain: costAlertDom, brand: 'CostAlert', email: 'costalert@example.com' })).json();
  const costAlertAuth = body => ({ token: costAlertStarted.token, ...body });
  // Revenue = 9700 cents = R$97; 15% = R$14.55; set today cost to R$20
  redisCommand('RPUSH', 'swarm:txlog', JSON.stringify({ dom: costAlertDom, cents: 9700, rail: 'pix', ts: iso(), txid: 'tx1', lead_id: 'lead-1' }));
  redisCommand('HSET', 'swarm:llm:usage:' + costAlertDom + ':' + todayKey, 'tokens_in', '10000', 'tokens_out', '5000', 'cost_r$', '20.00', 'calls', '30');
  const costAlertResponse = await (await makeRequest('GET', '/api/usage-metrics?token=' + encodeURIComponent(costAlertStarted.token))).json();
  check('C3.3 alert cost_15pct triggered when cost >15% revenue', () => assert.ok(costAlertResponse.alerts.some(a => a.type === 'cost_15pct' && a.severity === 'critical')));

  console.log('V23 behavioral cases passed');
