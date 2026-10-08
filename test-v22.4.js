import assert from 'node:assert/strict';
import { agentRuns, dumpRedis, makeRequest, redisCommand, redisTtl, seedRedis, worker } from './test/harness.js';

function check(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.log(`FAIL ${name}`);
    throw error;
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.log(`FAIL ${name}`);
    throw error;
  }
}

async function setup(name) {
  const domain = `${name}.chatpay`;
  const response = await makeRequest('POST', '/start', { domain, brand: name, email: `${name}@example.com` });
  const data = await response.json();
  check(`token created for ${domain}`, () => assert.ok(data.token));
  seedRedis(`swarm:prods:${domain}`, [{ id: 1, name: 'Trial', cents: 9700, deliver: '/start-page' }]);
  return { domain, token: data.token, user: `${domain}-user` };
}

async function converse(store, text, type = 'whatsapp_intent') {
  redisCommand('DEL', `swarm:reply-queue:api:${store.domain}`);
  const response = await makeRequest('POST', '/api/swarm-event', {
    token: store.token,
    type,
    channel: 'api',
    user: store.user,
    convId: `${store.domain}-conv-${Date.now()}`,
    text
  });
  check(`event accepted: ${store.domain}/${text}`, () => assert.equal(response.status, 200));
  await worker.scheduled({ cron: '* * * * *' }, { AI: null }, {});
  const items = dumpRedis(`swarm:reply-queue:api:${store.domain}`).lists;
  return items.length ? items[0][1].map(value => JSON.parse(value)) : [];
}

const baseline = await setup('harness');
const baselineEvent = await makeRequest('POST', '/api/swarm-event', {
  token: baseline.token, type: 'whatsapp_intent', channel: 'api', user: 'user-1', text: 'EU QUERO', convId: 'conv-1'
});
check('baseline event accepted', () => assert.equal(baselineEvent.status, 200));
await worker.scheduled({ cron: '* * * * *' }, { AI: null }, {});
const baselineRuns = await agentRuns(baseline.domain);
const baselineQueue = dumpRedis(`swarm:reply-queue:api:${baseline.domain}`).lists;
check('baseline increments classifyIntent', () => assert.ok(baselineRuns.classifyIntent > 0));
check('EU QUERO generates payment link', () => assert.ok(baselineQueue.flatMap(([, values]) => values).some(item => item.includes(`pay?d=${baseline.domain}`))));

const objection = await setup('objection');
const objectionReplies = await converse(objection, 'achei caro');
check('objection includes guarantee', () => assert.match(objectionReplies[0].text, /garantia/i));
check('objection includes payment link', () => assert.match(objectionReplies[0].text, /pay\?d=/));
await checkAsync('objectionHandler execution is counted', async () => assert.ok((await agentRuns(objection.domain)).objectionHandler > 0));

const mild = await setup('mild');
const mildReplies = await converse(mild, 'quem sabe?');
check('mild interest asks a question', () => assert.match(mildReplies[0].text, /\?/));

const info = await setup('info');
const infoReplies = await converse(info, 'serve pra mei?');
check('info question includes answer and offer', () => assert.match(infoReplies[0].text, /Funciona.*pay\?d=/));

const ignore = await setup('ignore');
const ignoreReplies = await converse(ignore, 'não quero mais');
check('opt-out produces no reply', () => assert.equal(ignoreReplies.length, 0));
check('opt-out blacklists user', () => assert.equal(redisCommand('SISMEMBER', `swarm:blacklist:${ignore.domain}`, ignore.user).result, 1));
check('opt-out blacklist TTL is approximately 90 days', () => {
  const ttl = redisTtl(`swarm:blacklist:${ignore.domain}`);
  assert.ok(ttl > 7775900 && ttl <= 7776000, `TTL=${ttl}`);
});

const competitor = await setup('competitor');
const beforeNonCompetitor = await agentRuns(competitor.domain);
await converse(competitor, 'quero comprar');
const afterNonCompetitor = await agentRuns(competitor.domain);
check('competitorAnalyzer skips ordinary message', () => assert.equal(afterNonCompetitor.competitorAnalyzer || 0, beforeNonCompetitor.competitorAnalyzer || 0));
const competitorReplies = await converse(competitor, 'o fulano é mais barato');
const afterCompetitor = await agentRuns(competitor.domain);
check('competitorAnalyzer runs on competitor mention', () => assert.ok(afterCompetitor.competitorAnalyzer > (afterNonCompetitor.competitorAnalyzer || 0)));
check('competitor response compares value', () => assert.match(competitorReplies[0].text, /pagamento Pix|taxas abusivas/i));
check('whatsapp proof and timing agents execute', () => {
  assert.ok(afterCompetitor.proofGenerator > 0);
  assert.ok(afterCompetitor.timingOptimizer > 0);
});

const custom = await setup('custom');
const config = await makeRequest('POST', '/api/swarm-config', { token: custom.token, playbook: { replies: { buy: 'Olá {nome}, compre aqui: {link}' } } });
check('custom playbook accepted', () => assert.equal(config.status, 200));
const customReplies = await converse(custom, 'eu quero');
check('custom reply template is applied', () => assert.match(customReplies[0].text, /Olá.*pay\?d=/));
check('every hunter payment link carries lead_id', () => assert.match(customReplies[0].text, /lead_id=/));

const pricing = await setup('pricing');
await makeRequest('POST', '/api/swarm-config', { token: pricing.token, playbook: { floor: 9500, ceiling: 9600 } });
redisCommand('HSET', `swarm:exp:${pricing.domain}`, 'arm:10:success', '100', 'arm:10:trials', '100');
const floorOffer = await (await makeRequest('POST', '/api/price-offer', { token: pricing.token, base: 9700 })).json();
check('price offer never falls below floor', () => assert.ok(floorOffer.price >= 9500));
const ceilingOffer = await (await makeRequest('POST', '/api/price-offer', { token: pricing.token, base: 11000 })).json();
check('price offer never exceeds ceiling', () => assert.ok(ceilingOffer.price <= 9600));

const graphResponse = await makeRequest('GET', `/api/agent-graph?token=${encodeURIComponent(custom.token)}`);
const graph = await graphResponse.json();
check('agent graph reports real execution counts', () => assert.ok(graph.agentes && graph.agentes.classifyIntent.execucoes_hoje > 0));
console.log('V22.4 behavioral cases passed');
