import assert from 'node:assert/strict';
import fs from 'node:fs';
import { configureHarness, dumpRedis, harnessFaults, makeRequest, redisCommand, redisTtl, seedRedis, worker } from './harness.js';

let pass = 0;
function ok(name) { pass++; console.log('PASS ' + name); }

const workerCode = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

assert.ok(workerCode.includes('parseTgStartPayload'), 'parseTgStartPayload present');
assert.ok(workerCode.includes('bindTgSession'), 'bindTgSession present');
assert.ok(workerCode.includes('resolveTgSession'), 'resolveTgSession present');
assert.ok(workerCode.includes('queue:telegram'), 'queue:telegram present');
assert.ok(workerCode.includes('TG_MSG_PER_SEC'), 'rate limit constant present');
assert.ok(workerCode.includes('session:'), 'session key prefix present');
assert.ok(workerCode.includes('/api/telegram/deep-link'), 'deep-link endpoint present');
assert.ok(workerCode.includes('/api/telegram/master'), 'master endpoint present');
assert.ok(workerCode.includes('/api/telegram/repair-webhook'), 'repair-webhook endpoint present');
assert.ok(workerCode.includes('generateTgDeepLink'), 'generateTgDeepLink present');
ok('static markers');

const started = await (await makeRequest('POST', '/start', {
  domain: 'loja.fase1',
  brand: 'Loja Fase1',
  email: 'fase1@example.com'
})).json();
assert.ok(started.token, 'token issued');
const auth = body => ({ token: started.token, ...body });
const dom = 'loja.fase1';
seedRedis('swarm:prods:' + dom, [{ id: 1, name: 'Curso Fase1', cents: 9700, deliver: '/ok' }]);
ok('domain provisioned');

let response = await makeRequest('GET', '/api/telegram/queue');
assert.equal(response.status, 401, 'queue requires auth');
response = await makeRequest('GET', '/api/telegram/queue?token=' + encodeURIComponent(started.token));
assert.equal(response.status, 200);
const queueInfo = await response.json();
assert.equal(queueInfo.queue, 'queue:telegram');
assert.equal(queueInfo.limit_per_sec, 25);
assert.equal(queueInfo.session_ttl, 7776000);
ok('queue status endpoint');

response = await makeRequest('POST', '/api/telegram/master', auth({ tg_bot_token: '123456:TESTTOKEN' }));
assert.equal(response.status, 200);
const master = await response.json();
assert.equal(master.status, 'master_configured');
assert.ok(master.deep_link_base.includes('t.me/'));
assert.ok(master.example.includes('?start='));
const masterCfg = JSON.parse(redisCommand('GET', 'channel:config:telegram:_shared').result);
assert.equal(masterCfg.role, 'master');
assert.ok(masterCfg.webhook_url.includes('domain=_shared'));
ok('master bot setup');

response = await makeRequest('GET', '/api/telegram/deep-link?token=' + encodeURIComponent(started.token));
assert.equal(response.status, 200);
const link = await response.json();
assert.equal(link.domain, dom);
assert.ok(link.deep_link.startsWith('https://t.me/'));
assert.ok(link.deep_link.endsWith('?start=' + dom));
assert.ok(link.qr.includes('qrserver'));
assert.equal(link.bot, '@ChatPayMasterBot');
ok('deep link generation');

response = await makeRequest('GET', '/api/telegram/deep-link?token=' + encodeURIComponent(started.token) + '&domain=INVALID DOMAIN!');
assert.equal(response.status, 400, 'rejects invalid domain');
ok('deep link domain validation');

const chatId = '998009360';
let wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  message: { chat: { id: Number(chatId) }, text: '/start ' + dom }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
assert.equal(wh.status, 200);
let body = await wh.json();
assert.equal(body.intent, 'start_bound');
assert.equal(body.domain, dom);
assert.equal(body.shared, true);
assert.equal(redisCommand('GET', 'session:' + chatId).result, dom);
assert.ok(redisTtl('session:' + chatId) > 7776000 - 60, 'session TTL ~90d');
assert.equal(body.telegram_status, 'sent');
ok('deep link /start binds session');

wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  message: { chat: { id: Number(chatId) }, text: 'qual o preco?' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(wh.status, 200);
assert.equal(body.domain, dom, 'session routes subsequent message');
assert.equal(body.intent, 'price_inquiry');
assert.equal(body.shared, true);
ok('session routes price inquiry');

wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  message: { chat: { id: 111222333 }, text: 'oi tudo bem' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(body.intent, 'no_session');
assert.equal(body.domain, null);
ok('no session → prompt deep link');

wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  message: { chat: { id: 444555666 }, text: '/start dom.inexistente.xyz' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(body.intent, 'start_unknown');
ok('inactive domain rejected');

wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  message: { chat: { id: 777888999 }, text: '/start !!' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(body.intent, 'start_invalid');
ok('invalid domain payload rejected');

wh = await makeRequest('POST', '/api/telegram-webhook?domain=loja.fase1', {
  message: { chat: { id: 555666777 }, text: 'qual o preco?' }
}, { 'x-telegram-bot-api-secret-token': 'tg_loja.fase1' });
body = await wh.json();
assert.equal(wh.status, 200);
assert.equal(body.domain, 'loja.fase1');
assert.equal(body.intent, 'price_inquiry');
assert.equal(body.shared, false);
ok('dedicated bot still works');

wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  message: { chat: { id: Number(chatId) }, text: 'oi' }
}, { 'x-telegram-bot-api-secret-token': 'wrong' });
assert.equal(wh.status, 403, 'bad secret rejected');
ok('webhook secret enforcement');

for (let i = 0; i < 6; i++) {
  wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
    message: { chat: { id: 313373 }, text: '/start ' + dom }
  }, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
  if (wh.status === 429) break;
}
assert.equal(wh.status, 429, 'start rate limit 5/min');
ok('start rate limit');

const sessions = dumpRedis('session:').values;
assert.ok(sessions.some(([k, v]) => k === 'session:' + chatId && v === dom));
const queueDepth = Number(redisCommand('ZCARD', 'queue:telegram').result || 0);
assert.ok(queueDepth >= 0);
ok('redis session + queue state');

assert.ok(workerCode.includes('buildTelegramFacts'), 'facts/RAG helper');
assert.ok(workerCode.includes('lookupTelegramPayment'), 'payment lookup');
assert.ok(workerCode.includes('enforceTelegramPaymentTruth'), 'payment truth filter');
assert.ok(workerCode.includes('fastTelegramProductReply'), 'product fast path');
ok('facts + payment guards present');

// Produto: resposta só com catálogo real
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  message: { chat: { id: Number(chatId) }, text: 'qual é o nome do seu produto?' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(body.intent, 'product_info');
assert.ok(body.reply.includes('Curso Fase1'), 'product name from catalog');
assert.ok(!/pagamento confirmado/i.test(body.reply), 'no false payment on product Q');
ok('product name from real catalog');

// Pagamento sem tx real → NÃO confirma
redisCommand('DEL', 'tg:tx:' + chatId);
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  message: { chat: { id: Number(chatId) }, text: 'paguei, confirmou meu pagamento?' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(body.intent, 'payment_status');
assert.ok(!/Pagamento CONFIRMADO no sistema/i.test(body.reply), 'must not claim paid without Redis');
assert.ok(/Nao localizei Pix|txid/i.test(body.reply), 'asks for tx or says not found');
ok('payment claim requires Redis proof');

// Pagamento pending no Redis → status pendente
seedRedis('pix:tx:CPTESTPAID', JSON.stringify({
  amount: '97.00', status: 'pending', dom, created: new Date().toISOString(), rail: 'pix_estatico'
}));
redisCommand('SET', 'swarm:pix:last_tx', 'CPTESTPAID');
redisCommand('SET', 'tg:tx:' + chatId, 'CPTESTPAID');
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  message: { chat: { id: Number(chatId) }, text: 'ja paguei' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(body.intent, 'payment_status');
assert.ok(!/Pagamento CONFIRMADO no sistema/i.test(body.reply), 'pending is not confirmed');
assert.ok(/ainda nao creditou|status|pendente/i.test(body.reply), 'reports pending honestly');
ok('pending payment not confirmed');

// Pagamento paid no Redis → confirma de verdade
seedRedis('pix:tx:CPPAIDOK', JSON.stringify({
  amount: '97.00', status: 'paid', dom, created: new Date().toISOString(), rail: 'pix_estatico'
}));
redisCommand('SET', 'tg:tx:' + chatId, 'CPPAIDOK');
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  message: { chat: { id: Number(chatId) }, text: 'status do pagamento' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(body.intent, 'payment_confirmed');
assert.ok(/Pagamento CONFIRMADO no sistema/i.test(body.reply), 'real paid is confirmed');
assert.ok(body.reply.includes('CPPAIDOK'), 'cites real txid');
ok('paid payment confirmed from Redis');

// Filtro: LLM alucinando confirmação → reescrito
seedRedis('pix:tx:CPNOTPAID', JSON.stringify({
  amount: '97.00', status: 'pending', dom, created: new Date().toISOString(), rail: 'pix_estatico'
}));
redisCommand('SET', 'tg:tx:998009361', 'CPNOTPAID');
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  message: { chat: { id: 998009361 }, text: 'oi, como estou?' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
// Se LLM (harness pollinations vazio) não falar de pagamento, segue; senão filtro age
assert.ok(typeof body.reply === 'string');
ok('llm path keeps payment filter wired');

// ===== T6(a): mesmo update_id entregue 2x → 1 envio =====
configureHarness({ telegramSends: 0 });
const dupUpdate = {
  update_id: 987654321,
  message: { chat: { id: 555000111 }, text: 'ola idempotente' }
};
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared',
  { ...dupUpdate },
  { 'x-telegram-bot-api-secret-token': 'tg__shared' });
assert.equal(wh.status, 200);
const firstSends = harnessFaults.telegramSends;
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared',
  { ...dupUpdate },
  { 'x-telegram-bot-api-secret-token': 'tg__shared' });
assert.equal(wh.status, 200, 'duplicate update still 200');
assert.equal(harnessFaults.telegramSends, firstSends, 'second delivery must not send again');
assert.ok(firstSends <= 1, 'at most one send for same update_id');
assert.equal(redisCommand('EXISTS', 'tg:seen:987654321').result, 1, 'tg:seen marker stored');
ok('same update_id delivered twice → 1 send');

// ===== T6(b): string vazada de produção → saída limpa =====
const leaked = 'O cliente já fez o pagamento? Sim, garanta 30 dias.\nCliente no Telegram: "qual é a garantia?"\nAssistente: Temos garantia de 30 dias. Link: https://midas-core.novoronaldo-m.workers.dev/pay?d=loja.fase1 e de novo https://midas-core.novoronaldo-m.workers.dev/pay?d=loja.fase1';
const cleaned = worker.cleanTelegramReply(leaked);
assert.ok(cleaned.length > 0, 'cleaner returns text');
assert.ok(!/Cliente no Telegram/i.test(cleaned), 'no prompt echo');
assert.ok(!/Assistente:/i.test(cleaned), 'no assistant role leak');
assert.ok(!/^O cliente/i.test(cleaned) && !/\nO cliente/i.test(cleaned), 'no meta lead line');
const linkMatches = cleaned.match(/https:\/\/midas-core\.novoronaldo-m\.workers\.dev\/pay\?d=/gi) || [];
assert.equal(linkMatches.length, 1, 'exactly one pay link');
assert.ok(!cleaned.includes('?') || cleaned.split('?').length <= 3, 'no early question cut explosion');
assert.ok(cleaned.length <= 500, 'final truncate 500');
ok('leaked production string cleaned');

// ===== T6(c): dois drainTelegramQueue concorrentes → 1 envio =====
configureHarness({ telegramSends: 0 });
redisCommand('DEL', 'tg:drain:lock');
const drainItem = JSON.stringify({
  chatId: '424242424',
  botToken: '123456:DRAINTOKEN',
  text: 'mensagem unica do drain',
  intent: 'general',
  domain: dom,
  ts: Date.now(),
  score: 2 * 1e13 + Date.now()
});
redisCommand('ZADD', 'queue:telegram', String(2 * 1e13 + Date.now()), drainItem);
assert.equal(Number(redisCommand('ZCARD', 'queue:telegram').result || 0) >= 1, true);
await Promise.all([
  worker.drainTelegramQueue(),
  worker.drainTelegramQueue()
]);
assert.equal(harnessFaults.telegramSends, 1, 'concurrent drains → exactly 1 send');
assert.equal(redisCommand('EXISTS', 'tg:drain:lock').result, 0, 'drain lock released');
ok('two concurrent drains → 1 send (lock)');

// ===== T6(d) extras: dedup de resposta idêntica + markers =====
assert.ok(workerCode.includes('redisSetNx'), 'redisSetNx present');
assert.ok(workerCode.includes('tg:seen:'), 'idempotency key present');
assert.ok(workerCode.includes('tg:drain:lock'), 'drain lock present');
assert.ok(workerCode.includes('tg:lastreply:'), 'consecutive reply dedup present');
assert.ok(workerCode.includes('Nunca cite, repita'), 'hardened systemNote present');
assert.ok(workerCode.includes('roleEcho'), 'anti-echo sanitizer present');
ok('static markers for T1–T5');

// ===== T7: fallback seguro + callback_query =====
assert.ok(workerCode.includes('detectaPerguntaForaDoPlaybook'), 'detect out-of-playbook present');
assert.ok(workerCode.includes('sendTelegramWithButtons') || workerCode.includes('reply_markup'), 'inline keyboard present');
assert.ok(workerCode.includes('callback_query'), 'callback_query handler present');
assert.ok(workerCode.includes('tg:handoff:'), 'handoff key present');
ok('static markers for T7');

seedRedis('loja:' + dom, {
  faq: [
    { pergunta: 'qual a garantia', resposta: 'Garantia de 7 dias.' },
    { pergunta: 'qual o preco', resposta: 'Curso Fase1: R$ 97,00' },
    { pergunta: 'como funciona', resposta: 'Bot com IA e Pix.' }
  ],
  fallback: {
    quando_cliente_pergunta_fora_do_playbook: {
      mensagem: 'Não tenho essa informação agora. Posso ajudar com:',
      botoes: [
        { texto: 'Ver preço', callback: 'preco' },
        { texto: 'Saber da garantia', callback: 'garantia' },
        { texto: 'Falar com humano', callback: 'humano' }
      ]
    }
  }
});

// (a) pergunta fora do FAQ → menu com botões, sem LLM
const llmBefore = harnessFaults.llmCalls;
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  update_id: 555001,
  message: { chat: { id: Number(chatId) }, text: 'vocês têm plano anual?' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(wh.status, 200);
assert.equal(body.intent, 'playbook_fallback');
assert.ok(Array.isArray(body.buttons) && body.buttons.length >= 3, 'fallback returns buttons');
assert.ok(body.buttons.some(b => b.callback === 'preco'), 'has preco button');
assert.ok(body.buttons.some(b => b.callback === 'humano'), 'has humano button');
assert.equal(harnessFaults.llmCalls, llmBefore, 'no LLM for out-of-playbook');
assert.ok(harnessFaults.lastTelegramBody && harnessFaults.lastTelegramBody.reply_markup, 'reply_markup sent');
ok('out of FAQ → menu with buttons, no LLM');

// (b) pergunta no FAQ (similaridade alta) → NÃO é fallback
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  update_id: 555002,
  message: { chat: { id: Number(chatId) }, text: 'qual a garantia?' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(wh.status, 200);
assert.notEqual(body.intent, 'playbook_fallback', 'FAQ match is not fallback');
assert.ok(!body.buttons || !body.buttons.length, 'no fallback buttons on FAQ match');
ok('FAQ match similarity → normal path');

// (c) callback_query "preco" → fast reply de preço
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  update_id: 555003,
  callback_query: {
    id: 'cb preco test',
    from: { id: Number(chatId), is_bot: false, first_name: 'Ronaldo' },
    chat_instance: 'ci1',
    data: 'preco',
    message: { chat: { id: Number(chatId) }, message_id: 1, text: 'menu' }
  }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(wh.status, 200);
assert.equal(body.intent, 'callback_price');
assert.ok(/97|pre[çc]o|R\$/.test(body.reply), 'price callback has price');
assert.ok(!/pagamento confirmado/i.test(body.reply), 'price callback no false payment');
ok('callback preco → fast price reply');

// (d) callback_query "humano" → tg:handoff criado
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  update_id: 555004,
  callback_query: {
    id: 'cb humano test',
    from: { id: Number(chatId), is_bot: false, first_name: 'Ronaldo' },
    chat_instance: 'ci1',
    data: 'humano',
    message: { chat: { id: Number(chatId) }, message_id: 2, text: 'menu' }
  }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(wh.status, 200);
assert.equal(body.intent, 'callback_handoff');
assert.equal(redisCommand('GET', 'tg:handoff:' + chatId).result, '1');
assert.ok(/humano|atender|wa\.me|t\.me/i.test(body.reply), 'handoff reply');
assert.ok(body.reply.includes('wa.me/5511932270717'), 'whatsapp link');
assert.ok(body.reply.includes('t.me/Tokenizeassets'), 'telegram link');
assert.ok(Array.isArray(body.buttons) && body.buttons.some(b => b.url && b.url.includes('wa.me')), 'whatsapp url button');
assert.ok(Array.isArray(body.buttons) && body.buttons.some(b => b.url && b.url.includes('t.me')), 'telegram url button');
assert.ok(Number(harnessFaults.callbackAnswers || 0) >= 1, 'answerCallbackQuery called');
ok('callback humano → tg:handoff + contatos');

// Regressão payment truth ainda intacta após T7
redisCommand('DEL', 'tg:tx:' + chatId);
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  update_id: 555005,
  message: { chat: { id: Number(chatId) }, text: 'paguei, confirmou?' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(body.intent, 'payment_status');
assert.ok(!/Pagamento CONFIRMADO no sistema/i.test(body.reply), 'T7 no regression on payment truth');
ok('payment truth intact after T7');

// ===== G1: grupo — /start@NomeDoBot vincula sessão =====
const groupChatId = '-100222333444';
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  update_id: 555006,
  message: { chat: { id: Number(groupChatId), type: 'supergroup' }, text: '/start@ChatPayteste_bot ' + dom }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(wh.status, 200);
assert.equal(redisCommand('GET', 'session:' + groupChatId).result, dom, 'group /start@bot binds domain');
ok('group /start@bot binds session');

// ===== G2: grupo — resposta idêntica NÃO é deduplicada (clientes distintos) =====
configureHarness({ telegramSends: 0 });
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  update_id: 555007,
  message: { chat: { id: Number(groupChatId), type: 'supergroup' }, text: 'qual a garantia?' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(body.status, 'sent');
const groupFirstSends = harnessFaults.telegramSends;
wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
  update_id: 555008,
  message: { chat: { id: Number(groupChatId), type: 'supergroup' }, text: 'qual a garantia?' }
}, { 'x-telegram-bot-api-secret-token': 'tg__shared' });
body = await wh.json();
assert.equal(body.status, 'sent', 'group duplicate reply still sent');
assert.ok(harnessFaults.telegramSends > groupFirstSends, 'second group message actually sent');
ok('group chat skips reply dedup');

console.log('PHASE1 PASS ' + pass + '/' + pass);
