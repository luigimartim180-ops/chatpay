import assert from 'node:assert/strict';
import fs from 'node:fs';
import { configureHarness, harnessFaults, makeRequest, redisCommand, seedRedis, worker } from './harness.js';

let pass = 0;
function ok(name) { pass++; console.log('PASS ' + name); }

const workerCode = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');

// ===== Static markers (diretriz: links + RAG + tools + voz) =====
assert.ok(workerCode.includes('function buildPayLink'), 'buildPayLink');
assert.ok(workerCode.includes('function linkPolicy'), 'linkPolicy');
assert.ok(workerCode.includes('function applyLinkPolicy'), 'applyLinkPolicy');
assert.ok(workerCode.includes('function chunkText'), 'chunkText');
assert.ok(workerCode.includes('async function kbUpload'), 'kbUpload');
assert.ok(workerCode.includes('async function kbRetrieve'), 'kbRetrieve');
assert.ok(workerCode.includes('/api/kb/upload'), 'kb upload endpoint');
assert.ok(workerCode.includes('parseTgToolCall'), 'tool parser');
assert.ok(workerCode.includes('executeTgTool'), 'tool executor');
assert.ok(workerCode.includes('callLlmTgTurn'), 'tool LLM turn');
assert.ok(workerCode.includes('TG_TOOLS'), 'tool registry');
assert.ok(workerCode.includes('RESULTADO DA FERRAMENTA'), 'tool loop feedback');
assert.ok(workerCode.includes('transcribeTelegramAudio'), 'STT helper');
assert.ok(workerCode.includes('@cf/openai/whisper-large-v3-turbo'), 'whisper model');
assert.ok(workerCode.includes('sendChatAction'), 'typing action');
assert.ok(workerCode.includes('tg:metric:audio:'), 'audio metric');
assert.ok(workerCode.includes('kb_rag_reply'), 'KB override intent');
assert.ok(workerCode.includes("get('p')"), 'pay page product param');
assert.ok(workerCode.includes('&p=') || workerCode.includes('&p=' + "'"), 'dynamic p= in pay link');
ok('static markers fase3 (links/RAG/tools/voz)');

// ===== Units: chunkText (800/100) =====
{
  const src = 'a'.repeat(2000);
  const chunks = worker.chunkText(src, 800, 100);
  assert.ok(chunks.length >= 3, 'multiple chunks');
  assert.ok(chunks.every(c => c.length <= 800), 'chunk <= 800');
  assert.equal(chunks[0].slice(700), chunks[1].slice(0, 100), 'overlap 100 chars');
  assert.equal(worker.chunkText('').length, 0);
  ok('chunkText 800/100');
}

// ===== Units: chunkText (### > ## > janela) =====
{
  // Doc com ###: só subseções viram chunk, com CABEÇALHOS PRESERVADOS para contexto
  const doc = '# Titulo\nintro\n## Curta\ntexto curto da secao\n## Grande\n' + 'x'.repeat(1000) + '\n### Sub\nsubsecao importante';
  const ch = worker.chunkText(doc, 800, 100);
  assert.equal(ch.length, 1, 'so a subsecao vira chunk');
  assert.ok(ch[0].includes('##'), 'com cabeçalho ## no chunk para contexto');
  assert.ok(ch[0].includes('###'), 'com cabeçalho ### no chunk para contexto');
  assert.ok(ch[0].includes('subsecao importante'), 'conteúdo real preservado');
  // Doc só com ##: secoes com cabeçalhos preservados
  const doc2 = 'intro\n## A\ntexto a\n## B\n' + 'y'.repeat(900);
  const ch2 = worker.chunkText(doc2, 800, 100);
  assert.ok(ch2.some(c => c.includes('## A')) && ch2.some(c => c.includes('## B')), 'com cabeçalhos ## nos chunks para contexto');
  assert.ok(ch2.every(c => c.length <= 800), 'chunks <= 800');
  // Sem cabecalho: janela pura 800/100
  const plano = worker.chunkText('linha simples sem cabecalho '.repeat(50), 800, 100);
  assert.ok(plano.length >= 2, 'texto sem ## continua em janela');
  assert.equal(plano[0].slice(700), plano[1].slice(0, 100), 'overlap 100 no plano');
  ok('chunkText secoes ##/### com cabeçalhos preservados para contexto');
}

// ===== Units: linkPolicy / applyLinkPolicy =====
{
  assert.equal(worker.linkPolicy('guarantee_inquiry', 'qual a garantia?'), false, 'garantia sem link');
  assert.equal(worker.linkPolicy('product_info', 'o que voces vendem?'), false, 'produto sem link');
  assert.equal(worker.linkPolicy('general', 'sobre a empresa'), false, 'geral sem link');
  assert.equal(worker.linkPolicy('intent_compra', 'quero comprar'), true, 'compra com link');
  assert.equal(worker.linkPolicy('cmd_price', ''), true, 'price intent com link');
  assert.equal(worker.linkPolicy('payment_status', ''), true, 'payment intent com link');
  assert.equal(worker.linkPolicy('general', 'manda o link do pix'), true, 'pedido explicito de link');
  const stripped = worker.applyLinkPolicy('Garantia de 7 dias. Link: https://midas-core.novoronaldo-m.workers.dev/pay?d=x', 'guarantee_inquiry', 'garantia');
  assert.ok(!stripped.includes('/pay?'), 'applyLinkPolicy remove pay-link');
  const kept = worker.applyLinkPolicy('Segue o link: https://midas-core.novoronaldo-m.workers.dev/pay?d=x&p=1', 'intent_compra', 'quero comprar');
  assert.ok(kept.includes('/pay?d=x&p=1'), 'applyLinkPolicy mantem link de compra');
  ok('linkPolicy units');
}

// ===== Units: buildPayLink + tool parser/executor =====
{
  assert.equal(worker.buildPayLink('loja.x', ''), 'https://midas-core.novoronaldo-m.workers.dev/pay?d=loja.x');
  assert.equal(worker.buildPayLink('loja.x', 'prod1'), 'https://midas-core.novoronaldo-m.workers.dev/pay?d=loja.x&p=prod1');
  const tool = worker.parseTgToolCall('{"tool":"checkout_link","args":{}}');
  assert.equal(tool && tool.tool, 'checkout_link');
  assert.equal(worker.parseTgToolCall('{"intent":"preco","reply":"ok"}'), null, 'intent JSON nao e tool');
  assert.equal(worker.parseTgToolCall('{"tool":"nao_existe","args":{}}'), null, 'tool desconhecida');
  assert.equal(worker.parseTgToolCall('texto livre'), null);
  ok('buildPayLink + parseTgToolCall');
}
// ===== Setup (mesmo padrao do phase2) =====
const started = await (await makeRequest('POST', '/start', {
  domain: 'loja.fase3',
  brand: 'Loja Fase3',
  email: 'fase3@example.com'
})).json();
assert.ok(started.token);
const dom = 'loja.fase3';
const chatId = '777888999';
seedRedis('swarm:prods:' + dom, [{ id: 1, name: 'ChatPay Trial 30d', cents: 9700, deliver: '/ok' }]);
seedRedis('loja:' + dom, {
  faq: [
    { pergunta: 'posso cancelar depois?', resposta: 'Sim, cancelar e simples.' },
    { pergunta: 'qual a garantia', resposta: 'Garantia de 7 dias.' },
    { pergunta: 'qual o preco', resposta: 'ChatPay Trial 30d: R$ 97,00' },
    { pergunta: 'como funciona', resposta: 'Bot com IA e Pix.' }
  ],
  fallback: {
    quando_cliente_pergunta_fora_do_playbook: {
      mensagem: 'Nao tenho essa informacao agora. Posso ajudar com:',
      botoes: [
        { texto: 'Quero comprar', callback: 'comprar' },
        { texto: 'Preco', callback: 'preco' },
        { texto: 'Garantia', callback: 'garantia' },
        { texto: 'Falar com humano', callback: 'humano' }
      ]
    }
  }
});

// ===== Units: fillKbVars ({{VAR}} → dados reais) =====
{
  const filled = await worker.fillKbVars('{{NOME_AGENTE}} da {{NOME_LOJA}}: {{PRODUTO_PRINCIPAL}} {{PRECO}} ({{GARANTIA_DIAS}} dias) em {{LINK_CHECKOUT}} {{DESCONHECIDA}}', 'loja.fase3');
  assert.ok(!filled.includes('{{'), 'sem residuo de variavel');
  assert.ok(filled.includes('ChatPay Trial 30d'), 'PRODUTO_PRINCIPAL preenchido');
  assert.ok(filled.includes('R$ 97,00'), 'PRECO preenchido');
  assert.ok(filled.includes('Mafel'), 'NOME_AGENTE default');
  assert.ok(filled.includes('loja.fase3'), 'NOME_LOJA fallback dominio');
  assert.ok(filled.includes('pay?d=loja.fase3&p=1'), 'LINK_CHECKOUT com p=');
  const semVar = await worker.fillKbVars('texto puro da loja', 'loja.fase3');
  assert.equal(semVar, 'texto puro da loja', 'sem {{ nao altera');
  ok('fillKbVars unidades');
}
await makeRequest('POST', '/api/telegram/master', { token: started.token, tg_bot_token: '123456:TESTTOKEN' });
const H = { 'x-telegram-bot-api-secret-token': 'tg__shared' };
let updateSeq = 700000;
async function send(text, id = chatId) {
  updateSeq += 1;
  const wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
    update_id: updateSeq,
    message: { chat: { id: Number(id) }, text }
  }, H);
  return { status: wh.status, body: await wh.json() };
}
async function cb(data, id = chatId) {
  updateSeq += 1;
  const wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
    update_id: updateSeq,
    callback_query: {
      id: 'cb' + updateSeq,
      from: { id: Number(id), is_bot: false, first_name: 'Ronaldo' },
      chat_instance: 'ci',
      data,
      message: { chat: { id: Number(id) }, message_id: 1, text: 'menu' }
    }
  }, H);
  return { status: wh.status, body: await wh.json() };
}

// Bind session
{
  updateSeq += 1;
  const wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
    update_id: updateSeq,
    message: { chat: { id: Number(chatId) }, text: '/start ' + dom }
  }, H);
  const body = await wh.json();
  assert.equal(body.intent, 'start_bound');
  ok('P1 /start bind session fase3');
}

// (0) executeTgTool deterministico (posis /start, apos configure() do worker)
{
  const out = await worker.executeTgTool('checkout_link', {}, { domain: dom, chatId, text: '', env: null });
  assert.ok(out.reply.includes('pay?d=loja.fase3&p=1'), 'checkout_link usa produto unico com p=');
  const pix = await worker.executeTgTool('check_pix', {}, { domain: dom, chatId, text: '', env: null });
  assert.ok(typeof pix.reply === 'string' && pix.reply.length > 0, 'check_pix responde sem inventar');
  const faq = await worker.executeTgTool('faq_search', { q: 'qual a garantia' }, { domain: dom, chatId, text: '', env: null });
  assert.ok(/garantia/i.test(faq.reply), 'faq_search usa FAQ real');
  ok('executeTgTool deterministic');
}

// (1) Fora do playbook SEM KB → fallback com botoes
{
  const { body } = await send('voce aceita criptomoeda bitcoin?');
  assert.equal(body.intent, 'playbook_fallback', 'sem KB → fallback');
  assert.ok(body.buttons && body.buttons.length >= 3, 'fallback buttons');
  ok('out-of-playbook sem KB → playbook_fallback');
}

// (2) /api/kb/upload: auth + chunk no Redis
{
  const noAuth = await makeRequest('POST', '/api/kb/upload', { key: 'wrong', domain: dom, filename: 'cripto.md', content: 'voce aceita criptomoeda bitcoin — sim, aceita criptomoeda e bitcoin.' });
  assert.equal(noAuth.status, 401, 'sem key valida → 401');
  const up = await makeRequest('POST', '/api/kb/upload', {
    key: 'test-midas-secret',
    domain: dom,
    filename: 'cripto.md',
    content: 'voce aceita criptomoeda bitcoin — sim, aceita criptomoeda e bitcoin. Pagamento em criptomoeda aceita bitcoin.'
  });
  const upBody = await up.json();
  assert.equal(up.status, 200, 'upload aceito');
  assert.equal(upBody.status, 'ok');
  assert.ok(upBody.chunks >= 1, 'chunk gerado');
  const stored = JSON.parse(redisCommand('GET', 'kb:' + dom).result || '[]');
  assert.ok(stored.some(c => c.file === 'cripto.md'), 'espelho Redis kb:{dom}');
  ok('kb upload auth + Redis mirror');
}

// (3) Fora do playbook COM KB → override RAG (kb_rag_reply)
{
  const { body } = await send('voce aceita criptomoeda bitcoin?');
  assert.equal(body.intent, 'kb_rag_reply', 'KB override em vez de fallback');
  assert.ok(/criptomoeda/.test(body.reply), 'resposta vem da KB');
  ok('KB override fora do playbook');
}

// (4) KB injetada no prompt do LLM (systemNote BASE DE CONHECIMENTO)
{
  const up = await makeRequest('POST', '/api/kb/upload', {
    key: 'test-midas-secret',
    domain: dom,
    filename: 'cancelar.md',
    content: 'Posso cancelar depois? Sim, cancelar assinatura pelo painel depois de 30 dias direto na conta.'
  });
  assert.equal(up.status, 200);
  harnessFaults.lastPrompt = '';
  configureHarness({ llmQueue: ['{"intent":"duvida","reply":"Respondemos direto da base."}'] });
  const { body } = await send('posso cancelar depois?');
  assert.equal(body.intent, 'llm_duvida', 'LLM path com KB');
  assert.ok(harnessFaults.lastPrompt.includes('BASE DE CONHECIMENTO'), 'KB injetada no prompt');
  assert.ok(harnessFaults.lastPrompt.includes('cancelar assinatura'), 'chunk da KB presente');
  assert.equal(harnessFaults.llmQueue.length, 0, 'fila LLM consumida');
  configureHarness({ llmQueue: [] });
  ok('KB injetada no systemNote');
}

// (4b) Upload MAFEL ({{VAR}} + secoes) → override com variaveis preenchidas e gate de link
{
  const up = await makeRequest('POST', '/api/kb/upload', {
    key: 'test-midas-secret',
    domain: dom,
    filename: 'mafel.md',
    content: '## 5.3 confianca\nGarantia de {{GARANTIA_DIAS}} dias com risco invertido em {{LINK_CHECKOUT}}. O risco fica do nosso lado, nao do seu.'
  });
  assert.equal(up.status, 200);
  const upBody2 = await up.json();
  assert.equal(upBody2.chunks, 1, 'secao curta = 1 chunk');
  const stored2 = JSON.parse(redisCommand('GET', 'kb:' + dom).result || '[]');
  const mafelChunk = stored2.find(c => c.file === 'mafel.md');
  assert.ok(mafelChunk && mafelChunk.secao === '5.3 confianca', 'metadata secao');
  const { body } = await send('risco do teste e seu ou meu?');
  assert.equal(body.intent, 'kb_rag_reply', 'override com secao MAFEL');
  assert.ok(/7 dias/.test(body.reply), 'GARANTIA_DIAS preenchida');
  assert.ok(!body.reply.includes('{{'), 'sem residuo {{}} no reply');
  assert.ok(!/\/pay\?/.test(body.reply), 'gate remove LINK_CHECKOUT sem intencao de compra');
  ok('fillKbVars no override + secao upload');
}

// (5) Tool calling loop (max 2 rodadas) com dado real
{
  harnessFaults.lastPrompt = '';
  configureHarness({ llmQueue: [
    '{"tool":"checkout_link","args":{}}',
    '{"intent":"compra","reply":"Fechado, te passo o link agora."}'
  ] });
  const { body } = await send('posso cancelar depois?');
  assert.equal(body.intent, 'llm_compra', 'contrato final apos tool');
  assert.ok(harnessFaults.lastPrompt.includes('RESULTADO DA FERRAMENTA'), 'tool result devolvido ao LLM');
  assert.ok(harnessFaults.lastPrompt.includes('checkout_link'), 'tool executada');
  assert.ok(/pay\?d=loja\.fase3&p=1/.test(body.reply), 'reply final com link dinamico p=1');
  assert.equal(harnessFaults.llmQueue.length, 0, 'loop consumiu 2 turnos');
  configureHarness({ llmQueue: [] });
  ok('tool loop checkout_link → link p=');
}

// (6) linkPolicy gate: LLM que tenta mandar link em duvida → strip
{
  configureHarness({ llmQueue: [
    '{"intent":"duvida","reply":"Garantia de 7 dias. Link: https://midas-core.novoronaldo-m.workers.dev/pay?d=loja.fase3"}'
  ] });
  const { body } = await send('posso cancelar depois?');
  assert.equal(body.intent, 'llm_duvida');
  assert.ok(!/pay\?d=/.test(body.reply), 'gate remove link fora de compra');
  configureHarness({ llmQueue: [] });
  ok('linkPolicy gate no caminho LLM');
}

// (7) Garantia (texto livre e callback) SEM pay-link
{
  const freeText = await send('qual a garantia?');
  assert.equal(freeText.body.intent, 'guarantee_inquiry');
  assert.ok(!/pay\?d=/.test(freeText.body.reply), 'garantia free text sem link');
  const viaCb = await cb('garantia');
  assert.equal(viaCb.body.intent, 'callback_guarantee');
  assert.ok(!/pay\?d=/.test(viaCb.body.reply), 'callback garantia sem link');
  assert.ok(/garantia|7 dias/i.test(viaCb.body.reply), 'garantia responde garantia');
  ok('garantia sem pay-link (texto + callback)');
}

// (8) Produto (pergunta de catalogo) SEM pay-link
{
  const { body } = await send('qual o nome do seu produto?');
  assert.equal(body.intent, 'product_info');
  assert.ok(body.reply.includes('ChatPay Trial 30d'), 'nome real do catalogo');
  assert.ok(!/pay\?d=/.test(body.reply), 'produto sem link');
  ok('product_info sem pay-link');
}

// (9) Compra/preco COM link dinamico p=1
{
  const buy = await cb('comprar');
  assert.equal(buy.body.intent, 'callback_buy');
  assert.ok(/pay\?d=loja\.fase3&p=1/.test(buy.body.reply), 'callback compra com p=1');
  const price = await cb('preco');
  assert.equal(price.body.intent, 'callback_price');
  assert.ok(/97|R\$/.test(price.body.reply), 'preco com valor');
  assert.ok(/pay\?d=loja\.fase3&p=1/.test(price.body.reply), 'preco com p=1');
  ok('compra/preco com link dinamico p=');
}

// (10) Voz: STT indisponível → fallback honesto + métrica + typing + getFile
{
  const chatActionsBefore = harnessFaults.chatActions || 0;
  const getFileBefore = harnessFaults.getFileCalls || 0;
  updateSeq += 1;
  const wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
    update_id: updateSeq,
    message: { chat: { id: Number(chatId) }, voice: { file_id: 'voicefile123', file_size: 4096, mime_type: 'audio/ogg' } }
  }, H);
  const body = await wh.json();
  assert.equal(wh.status, 200, 'voz nao da 400');
  assert.equal(body.intent, 'audio_failed', 'STT indisponivel → fallback honesto');
  assert.ok(/texto/.test(body.reply), 'pede para mandar texto');
  assert.ok((harnessFaults.chatActions || 0) > chatActionsBefore, 'sendChatAction typing');
  assert.ok((harnessFaults.getFileCalls || 0) > getFileBefore, 'getFile chamado');
  const day = new Date().toISOString().slice(0, 10);
  assert.equal(Number(redisCommand('GET', 'tg:metric:audio:' + day).result || 0), 1, 'metrica audio incrementada');
  ok('voz → STT fallback + metrica');
}

// (11) pay?p= no client + exports
{
  assert.ok(workerCode.includes("URLSearchParams(location.search).get('p')"), 'payPage le ?p=');
  assert.ok(workerCode.includes('PSEL'), 'auto-buy por PSEL');
  assert.equal(typeof worker.kbUpload, 'function', 'export kbUpload');
  assert.equal(typeof worker.kbRetrieve, 'function', 'export kbRetrieve');
  assert.equal(typeof worker.fillKbVars, 'function', 'export fillKbVars');
  assert.equal(typeof worker.linkPolicy, 'function', 'export linkPolicy');
  assert.equal(typeof worker.parseTgToolCall, 'function', 'export parseTgToolCall');
  assert.equal(typeof worker.executeTgTool, 'function', 'export executeTgTool');
  assert.equal(typeof worker.callLlmTgTurn, 'function', 'export callLlmTgTurn');
  assert.equal(typeof worker.transcribeTelegramAudio, 'function', 'export transcribeTelegramAudio');
  assert.equal(typeof worker.chunkText, 'function', 'export chunkText');
  ok('pay?p= + exports');
}

console.log('PHASE3 PASS ' + pass + '/' + pass);
