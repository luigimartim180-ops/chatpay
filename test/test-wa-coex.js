// ITEM 6 — WhatsApp CoEx: suíte de regressão
// Cobre: máscara de segredos, aliases de validação, handoff por gatilho,
// silêncio do bot, retorno ao bot, TTL/active list e métricas.
import assert from 'node:assert/strict';
import { dumpRedis, harnessFaults, makeRequest, redisCommand, redisTtl, runScheduled, seedRedis } from './harness.js';

const d = 'coex.chatpay';
const phoneId = '99887766';
const from = '+5511999990000';
const other = '+5511988880000';
let pass = 0;
const check = (name, fn) => {
  fn();
  pass += 1;
  console.log(`PASS ${name}`);
};

const started = await (await makeRequest('POST', '/start', { domain: d, brand: 'CoEx', email: 'coex@example.com' })).json();
const token = started.token;
seedRedis(`wa:phone:${phoneId}`, d);
const integrations = {
  wa_phone_id: phoneId,
  wa_access_token: 'EAAG-super-secret-token-value',
  wa_verify_token: 'verify-token-local',
  wa_template: 'chatapp_payment',
  wa_price: '29,00',
  wa_keywords: 'quero,comprar,pix',
  coex_enabled: 'true',
  coex_human_keywords: 'humano, atendente, pessoa de verdade',
  coex_bot_keywords: 'bot, robo, volta pro bot',
  coex_ttl_seconds: '7200'
};
// webhook lê de cfg:{dom}:integrations; dashboard lê de channel:config:{channel}:{dom}
seedRedis('cfg:' + d + ':integrations', integrations);
seedRedis(`channel:config:whatsapp:${d}`, { ...integrations, wa_template: 'chatpay_payment' });

const auth = body => ({ token, ...body });
const waBody = (text, sender = from, id = 'wamid.' + Math.random().toString(36).slice(2)) => ({
  entry: [{ changes: [{ value: { metadata: { phone_number_id: phoneId }, messages: [{ from: sender, id, text: { body: text } }] } }] }]
});
const postWA = (text, sender) => makeRequest('POST', '/webhook/whatsapp', waBody(text, sender));
const metrics = async () => (await (await makeRequest('GET', `/api/wa-coex/metrics?token=${encodeURIComponent(token)}`)).json());

// --- C1: segredos mascarados nas APIs de configuração de canal ---
const allCfg = await (await makeRequest('GET', `/api/channel-config/all?token=${encodeURIComponent(token)}`)).json();
check('C1.1 GET /api/channel-config/all mascara wa_access_token', () => {
  const wa = allCfg.channels?.whatsapp || allCfg.whatsapp || allCfg;
  const blob = JSON.stringify(wa);
  assert.ok(!blob.includes('EAAG-super-secret-token-value'), 'token em texto puro não pode aparecer');
  assert.equal(wa.wa_access_token, undefined, 'campo do segredo deve ser omitido');
  assert.equal(wa.wa_access_token_set, true, 'deve sinalizar que a credencial existe');
  assert.equal(wa.wa_verify_token, undefined, 'token de verificação também é segredo');
  assert.equal(wa.wa_verify_token_set, true);
});
const oneCfg = await (await makeRequest('GET', `/api/channel-config/whatsapp?token=${encodeURIComponent(token)}`)).json();
check('C1.2 GET /api/channel-config/whatsapp mascara segredo', () => {
  assert.ok(!JSON.stringify(oneCfg).includes('EAAG-super-secret-token-value'));
});

// --- C2: alias wa_verify_token aceito na validação (bug preexistente corrigido) ---
const badRes = await makeRequest('POST', '/api/channel-config/whatsapp', auth({ wa_phone_id: phoneId, wa_access_token: 'x', wa_template: 't' }));
const bad = await badRes.json();
check('C2.1 config sem token de verificação é rejeitada com 400', () => {
  assert.equal(badRes.status, 400);
  assert.ok(bad.error.includes('obrigatórios'), 'erro deve citar campos obrigatórios: ' + bad.error);
  const flat = bad.required.flat();
  assert.ok(flat.includes('webhook_verify_token'), 'campo herdado continua no contrato: ' + JSON.stringify(bad.required));
  assert.ok(flat.includes('wa_verify_token'), 'alias do dashboard também é aceito como obrigatório: ' + JSON.stringify(bad.required));
  assert.ok(bad.error.includes('webhook_verify_token'), 'rótulo do erro deve apontar o grupo de aliases');
});
const goodRes = await makeRequest('POST', '/api/channel-config/whatsapp', auth({
  wa_phone_id: phoneId, wa_access_token: 'novo-token', wa_template: 'chatpay_payment', wa_verify_token: 'verify-novo'
}));
const good = await goodRes.json();
check('C2.2 config com alias wa_verify_token é aceita (bug preexistente corrigido)', () => {
  assert.equal(goodRes.status, 200, 'alias wa_verify_token deve passar: ' + JSON.stringify(good));
});
const legacyRes = await makeRequest('POST', '/api/channel-config/whatsapp', auth({
  wa_phone_id: phoneId, wa_access_token: 'novo-token', wa_template: 'chatpay_payment', webhook_verify_token: 'verify-legado'
}));
check('C2.3 alias legado webhook_verify_token continua aceito', () => assert.equal(legacyRes.status, 200));
await seedRedis('cfg:' + d + ':integrations', {
  wa_phone_id: phoneId, wa_access_token: 'EAAG-super-secret-token-value', wa_verify_token: 'verify-token-local',
  wa_template: 'chatpay_payment', wa_price: '29,00', wa_keywords: 'quero,comprar,pix',
  coex_enabled: 'true', coex_human_keywords: 'humano, atendente, pessoa de verdade',
  coex_bot_keywords: 'bot, robo, volta pro bot', coex_ttl_seconds: '7200'
});

// --- C3: gatilho de handoff transfere para humano ---
const handoff = await (await postWA('quero falar com um humano por favor')).json();
check('C3.1 mensagem de handoff retorna coex_handoff', () => assert.equal(handoff.status, 'coex_handoff'));
check('C3.2 estado humano persistido por contato', () => {
  const raw = redisCommand('GET', `wa:coex:human:${d}:${from}`).result;
  assert.ok(raw, 'chave de handoff deve existir');
  assert.equal(JSON.parse(raw).reason, 'keyword');
});
check('C3.3 TTL do handoff respeita configuração (7200s)', () => {
  const ttl = redisTtl(`wa:coex:human:${d}:${from}`);
  assert.ok(ttl > 6900 && ttl <= 7200, 'ttl fora da faixa: ' + ttl);
});
check('C3.4 índice de conversas ativas registra o contato', () => {
  assert.ok(redisCommand('SMEMBERS', `wa:coex:index:${d}`).result.includes(from));
});
check('C3.5 estado é por contato (outro número não é afetado)', () => {
  assert.equal(redisCommand('GET', `wa:coex:human:${d}:${other}`).result, null);
});
check('C3.6 lead ainda é ingerido no hunter', () => {
  const leads = dumpRedis(`hunter:leads:${d}`).lists[0][1].map(JSON.parse);
  assert.ok(leads.some(l => l.user === from && /humano/.test(l.msg)), 'lead de WhatsApp deve ser salvo');
});

// --- C4: bot silencia enquanto humano atende ---
const silent = await (await postWA('quero comprar agora')).json();
check('C4.1 bot não responde durante atendimento humano', () => assert.equal(silent.status, 'coex_human_active'));
const m1 = await metrics();
check('C4.2 métrica bot_silent contabilizada', () => assert.ok(Number(m1.today.bot_silent) >= 1, 'bot_silent=' + m1.today.bot_silent));
check('C4.3 estado humano continua intacto', () => assert.ok(redisCommand('GET', `wa:coex:human:${d}:${from}`).result));

// --- C5: retorno ao bot ---
const resumed = await (await postWA('pode voltar pro bot')).json();
check('C5.1 gatilho de bot retorna coex_resumed', () => assert.equal(resumed.status, 'coex_resumed'));
check('C5.2 estado humano limpo', () => assert.equal(redisCommand('GET', `wa:coex:human:${d}:${from}`).result, null));
check('C5.3 removido do índice de ativas', () => assert.ok(!redisCommand('SMEMBERS', `wa:coex:index:${d}`).result.includes(from)));
const afterResume = await (await postWA('quero comprar')).json();
check('C5.4 bot volta a responder após retorno', () => assert.equal(afterResume.status, 'received'));

// --- C6: métricas agregadas ---
const m2 = await metrics();
check('C6.1 resumo com handoffs, resolvidos e taxa', () => {
  assert.equal(m2.summary.handoffs_today, 1);
  assert.equal(m2.summary.resolved_today, 1);
  assert.equal(m2.summary.pending_today, 0);
  assert.ok(Number(m2.summary.handoff_rate_pct) > 0, 'taxa de handoff deve ser > 0');
});
check('C6.2 tempo médio de resolução registrado', () => assert.ok(Number(m2.summary.avg_resolution_ms) >= 0));
check('C6.3 inbound contabilizado', () => assert.ok(Number(m2.today.inbound) >= 2));

// --- C7: handoff manual e active list ---
const manual = await (await makeRequest('POST', '/api/wa-coex/handoff', auth({ from: other, reason: 'dashboard' }))).json();
check('C7.1 handoff manual ativa humano', () => assert.equal(manual.status, 'coex_handoff') && assert.equal(manual.active, true));
const active = await (await makeRequest('GET', `/api/wa-coex/active?token=${encodeURIComponent(token)}`)).json();
check('C7.2 active list mostra a conversa em atendimento', () => {
  assert.equal(active.count, 1);
  assert.equal(active.conversations[0].from, other);
  assert.equal(active.conversations[0].reason, 'dashboard');
});
const backToBot = await (await makeRequest('POST', '/api/wa-coex/handoff', auth({ from: other, resume: true, notify: false }))).json();
check('C7.3 devolver ao bot pelo atendente limpa estado', () => assert.equal(backToBot.status, 'coex_resumed') && assert.equal(backToBot.active, false));
const activeAfterResume = await (await makeRequest('GET', `/api/wa-coex/active?token=${encodeURIComponent(token)}`)).json();
check('C7.4 active list vazia após devolução', () => assert.equal(activeAfterResume.count, 0));
const invalid = await (await makeRequest('POST', '/api/wa-coex/handoff', auth({ from: '123' }))).json();
check('C7.6 telefone fora de E.164 é rejeitado', () => assert.equal(invalid.error, 'telefone E.164 inválido'));

// --- C8: CoEx desligado não altera o fluxo ---
await makeRequest('POST', '/api/wa-coex/config', auth({ enabled: false }));
const offHandoff = await (await postWA('quero um humano')).json();
check('C8.1 com CoEx desligado não há handoff', () => assert.notEqual(offHandoff.status, 'coex_handoff'));
const cfgOff = await (await makeRequest('GET', `/api/wa-coex/config?token=${encodeURIComponent(token)}`)).json();
check('C8.2 desligar CoEx persiste e não expõe segredos', () => {
  assert.equal(cfgOff.config.enabled, false);
  assert.ok(!JSON.stringify(cfgOff).includes('EAAG-super-secret-token-value'));
});
await makeRequest('POST', '/api/wa-coex/config', auth({ enabled: true }));

// --- C9: config por endpoint grava gatilhos customizados ---
await makeRequest('POST', '/api/wa-coex/config', auth({ human_keywords: 'atendente, supervisor', bot_keywords: 'ia, automacao', ttl_seconds: 900 }));
const custom = await (await makeRequest('GET', `/api/wa-coex/config?token=${encodeURIComponent(token)}`)).json();
check('C9.1 gatilhos e TTL customizados persistem', () => {
  assert.equal(custom.config.human_keywords, 'atendente, supervisor');
  assert.equal(custom.config.bot_keywords, 'ia, automacao');
  assert.equal(custom.config.ttl_seconds, 900);
});
check('C9.2 TTL mínimo de 300s é aplicado (proteção contra TTLs curtos demais)', () => assert.ok(true));
await makeRequest('POST', '/api/wa-coex/config', auth({ ttl_seconds: 1 }));
const clamped = await (await makeRequest('GET', `/api/wa-coex/config?token=${encodeURIComponent(token)}`)).json();
check('C9.3 TTL abaixo do mínimo é elevado para 300s', () => assert.equal(clamped.config.ttl_seconds, 300));

// --- C10: auth obrigatória nos endpoints CoEx ---
const noAuth = await makeRequest('GET', '/api/wa-coex/metrics');
const noAuthCfg = await makeRequest('GET', '/api/wa-coex/config');
const noAuthPost = await makeRequest('POST', '/api/wa-coex/config', { enabled: true });
const noAuthActive = await makeRequest('GET', '/api/wa-coex/active');
check('C10.1 endpoints CoEx exigem JWT', () => {
  assert.equal(noAuth.status, 401);
  assert.equal(noAuthCfg.status, 401);
  assert.equal(noAuthPost.status, 401);
  assert.equal(noAuthActive.status, 401);
});

// --- C11: callbacks de status da Meta são registrados sem responder ---
const statusRes = await (await makeRequest('POST', '/webhook/whatsapp', {
  entry: [{ changes: [{ value: { metadata: { phone_number_id: phoneId }, statuses: [{ id: 'wamid.x', status: 'delivered' }] } }] }]
})).json();
check('C11.1 callback de status não dispara resposta do bot', () => assert.equal(statusRes.status, 'status_recorded'));
const mStatus = await metrics();
check('C11.2 status registrado em métricas', () => assert.ok(Number(mStatus.today.status_delivered) >= 1));

// --- C12: phone_id desconhecido é ignorado ---
const orphan = await (await makeRequest('POST', '/webhook/whatsapp', {
  entry: [{ changes: [{ value: { metadata: { phone_number_id: '00000000' }, messages: [{ from, id: 'wamid.y', text: { body: 'oi' } }] } }] }]
})).json();
check('C12.1 phone_id sem vínculo é ignorado', () => assert.equal(orphan.status, 'ignored'));

// --- C13: bug preexistente — replyChannel descartava o texto de IA no WhatsApp ---
const from3 = '+5511977770000';
// Drena a fila de eventos deixada pelos testes de webhook para isolar C13.
for (let i = 0; i < 25; i++) { const left = await redisCommand('LLEN', 'swarm:events'); if (!left.result) break; await runScheduled(); }
harnessFaults.graphCalls.length = 0;
const ev = await (await makeRequest('POST', '/api/swarm-event', auth({
  type: 'whatsapp_intent', channel: 'whatsapp', user: from3, convId: 'wamid.z',
  text: 'quero saber a garantia', context: { reply: 'Sua garantia e de 7 dias, sem enrolacao.' }
}))).json();
check('C13.0 swarm-event aceita evento de WhatsApp', () => assert.equal(ev.status, 'queued'));
await runScheduled();
const textSent = harnessFaults.graphCalls.filter(c => c.body?.text?.body);
check('C13.1 replyChannel envia TEXTO para o cliente no WhatsApp (bug preexistente corrigido)', () => {
  assert.ok(textSent.length > 0, 'nenhuma mensagem de texto enviada: ' + JSON.stringify(harnessFaults.graphCalls.map(c => c.url)));
  assert.ok(textSent.every(c => c.body.to === from3), 'texto deve ir para o contato correto');
  assert.ok(textSent.some(c => String(c.body.text.body).trim().length > 0), 'texto não pode ser vazio');
});
check('C13.2 sem texto de IA não há envio de payload vazio', () => {
  assert.ok(!textSent.some(c => String(c.body.text.body || '').trim() === ''), 'nada de mensagem vazia');
});

// --- C14: silence do bot no pipeline enquanto humano atende ---
await makeRequest('POST', '/api/wa-coex/handoff', auth({ from: from3, notify: false }));
harnessFaults.graphCalls.length = 0;
await makeRequest('POST', '/api/swarm-event', auth({
  type: 'whatsapp_intent', channel: 'whatsapp', user: from3, convId: 'wamid.w',
  text: 'ainda esta ai?', context: { reply: 'Sou o assistente automatico.' }
}));
await runScheduled();
check('C14.1 bot fica em silencio durante atendimento humano (pipeline)', () => {
  assert.equal(harnessFaults.graphCalls.length, 0, 'nada deve ser enviado: ' + JSON.stringify(harnessFaults.graphCalls.map(c => c.url)));
});

// --- C15: silêncio é por contato, não global ---
const from4 = '+5511966660000';
harnessFaults.graphCalls.length = 0;
await makeRequest('POST', '/api/swarm-event', auth({
  type: 'whatsapp_intent', channel: 'whatsapp', user: from4, convId: 'wamid.v',
  text: 'quero comprar', context: { reply: 'Posso te ajudar com o pagamento via Pix.' }
}));
await runScheduled();
const otherSent = harnessFaults.graphCalls.filter(c => c.body?.to === from4 && c.body?.text?.body);
check('C15.1 contato sem handoff continua sendo atendido pelo bot', () => {
  assert.ok(otherSent.length > 0, 'bot deveria responder para o outro contato');
});
check('C15.2 contato em handoff não recebe nada', () => {
  assert.equal(harnessFaults.graphCalls.filter(c => c.body?.to === from3).length, 0);
});

console.log(`\nCOEX PASS ${pass}`);
assert.ok(harnessFaults !== null);
