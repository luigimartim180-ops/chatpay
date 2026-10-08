import assert from 'node:assert/strict';
import fs from 'node:fs';
import { configureHarness, harnessFaults, makeRequest, redisCommand, seedRedis, worker } from './harness.js';

let pass = 0;
function ok(name) { pass++; console.log('PASS ' + name); }

const workerCode = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
const mafelKb = fs.readFileSync(new URL('../docs/kb/MAFEL-KB.md', import.meta.url), 'utf8');

// ===== Static markers (MAFEL §11 conjunto dourado) =====
assert.ok(workerCode.includes('faq_candidates'), 'faq_candidates');
assert.ok(workerCode.includes('REGRAS DO LOJISTA'), 'regras no facts');
assert.ok(workerCode.includes('PROIBICOES DO LOJISTA'), 'proibicoes no facts');
assert.ok(workerCode.includes('tg:lastreply:'), 'dedup de bolha identica');
assert.ok(mafelKb.includes('## 5.11'), 'MAFEL-KB.md presente');
ok('static markers golden MAFEL');

// ===== Setup =====
const started = await (await makeRequest('POST', '/start', {
  domain: 'loja.mafel',
  brand: 'Mafel QA',
  email: 'mafel@example.com'
})).json();
assert.ok(started.token);
const dom = 'loja.mafel';
const chat1 = 888999000;
const chat2 = 888999111;
const chat3 = 888999222;

seedRedis('swarm:prods:' + dom, [{ id: 1, name: 'ChatPay Trial 30d', cents: 9700, deliver: '/ok' }]);
seedRedis('loja:' + dom, {
  faq: [
    { pergunta: 'posso cancelar depois?', resposta: 'Sim, cancelar e simples.' },
    { pergunta: 'qual a garantia', resposta: 'Garantia de 7 dias.' },
    { pergunta: 'qual o preco', resposta: 'ChatPay Trial 30d: R$ 97,00' },
    { pergunta: 'como funciona', resposta: 'Bot com IA e Pix.' }
  ],
  produtos: [{ id: 'trial', nome: 'ChatPay Trial 30d', preco: 97, garantia: { dias: 7, texto: 'Garantia de 7 dias, reembolso de 100%' } }],
  regras_do_lojista: ['nunca oferecer desconto sem autorizacao'],
  proibicoes: ['falar de concorrentes pelo nome'],
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

const up = await makeRequest('POST', '/api/kb/upload', {
  key: 'test-midas-secret',
  domain: dom,
  filename: 'MAFEL-KB.md',
  content: mafelKb
});
const upBody = await up.json();
assert.equal(up.status, 200, 'upload MAFEL aceito');
assert.equal(upBody.status, 'ok');
assert.ok(upBody.chunks >= 15, 'MAFEL chunkada por subsecoes 5.x (>=15), got ' + upBody.chunks);
const kbMirror = JSON.parse(redisCommand('GET', 'kb:' + dom).result || '[]');
assert.ok(kbMirror.some(c => c.secao && c.secao.startsWith('5.11')), 'espelho com metadata secao');
assert.ok(!kbMirror.some(c => c.secao && /^(0\.|11\.|CONJUNTO DOURADO|COMO O SISTEMA)/.test(c.secao)), 'secoes meta fora da retrieval');
ok('setup: seed + upload MAFEL-KB');

await makeRequest('POST', '/api/telegram/master', { token: started.token, tg_bot_token: '123456:TESTTOKEN' });
const H = { 'x-telegram-bot-api-secret-token': 'tg__shared' };
let updateSeq = 910000;
async function send(text, id = chat1) {
  updateSeq += 1;
  const wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
    update_id: updateSeq,
    message: { chat: { id: Number(id) }, text }
  }, H);
  return { status: wh.status, body: await wh.json() };
}
async function sendVoice(id = chat1) {
  updateSeq += 1;
  const wh = await makeRequest('POST', '/api/telegram-webhook?domain=_shared', {
    update_id: updateSeq,
    message: { chat: { id: Number(id) }, voice: { file_id: 'vf' + updateSeq, file_size: 4096, mime_type: 'audio/ogg' } }
  }, H);
  return { status: wh.status, body: await wh.json() };
}
await send('/start ' + dom, chat1);

// G1 — "quanto custa?" → preco + preco real + max 1 link + sem markdown
{
  const { body } = await send('quanto custa?');
  assert.equal(body.intent, 'price_inquiry', 'fast-path preco');
  assert.ok(/97/.test(body.reply), 'preco real na resposta');
  const links = String(body.reply).match(/\/pay\?/g) || [];
  assert.ok(links.length <= 1, 'no maximo 1 link, got ' + links.length);
  assert.ok(!/\*\*|__/.test(body.reply), 'sem markdown');
  ok('G1 preco ancorado, 1 link max');
}

// G2 — "isso e golpe?" → irritado_ack, zero venda/defensiva
{
  const { body } = await send('isso é golpe?');
  assert.equal(body.intent, 'irritado_ack');
  assert.ok(!/\/pay\?/.test(body.reply), 'sem link em acusacao');
  assert.ok(!/!!/.test(body.reply), 'sem exclamacao dupla');
  ok('G2 golpe → irritado_ack sem venda');
}

// G3 — "paguei" sem pagar → frase de sistema, nunca CONFIRMADO
{
  redisCommand('DEL', 'tg:tx:' + chat1);
  const { body } = await send('paguei, confirmou meu pagamento?');
  assert.equal(body.intent, 'payment_status');
  assert.ok(/Nao localizei Pix|txid/i.test(body.reply), 'frase de sistema sem tx');
  assert.ok(!/Pagamento CONFIRMADO no sistema/i.test(body.reply), 'nunca confirma sem Redis');
  ok('G3 paguei sem pagar → honesto');
}

// G4 — voz "qual o preco?" → STT sucesso → fast-path preco
{
  const getFileBefore = harnessFaults.getFileCalls || 0;
  configureHarness({
    aiRunner: (model) => {
      if (String(model).includes('whisper')) return { text: 'qual o preco?' };
      throw new Error('modelo fora do teste: ' + model);
    },
    getFilePath: 'voice/file_1.ogg'
  });
  const { status, body } = await sendVoice();
  configureHarness({ aiRunner: null, getFilePath: null });
  assert.equal(status, 200, 'voz processada');
  assert.equal(body.intent, 'price_inquiry', 'STT → pipeline de texto → preco');
  assert.ok(/97/.test(body.reply), 'resposta de preco apos STT');
  assert.ok((harnessFaults.getFileCalls || 0) > getFileBefore, 'getFile chamado');
  ok('G4 voz STT sucesso → preco');
}

// G5 — "vendo trufas, serve pra mim?" → 5.6 costurada ao nicho (kb_rag_reply)
{
  const { body } = await send('vendo trufas, serve pra mim?');
  assert.equal(body.intent, 'kb_rag_reply', 'KB em vez de fallback');
  assert.ok(/nasceu para quem vende|aprende seus produtos|encaixa/i.test(body.reply), 'resposta 5.6 da MAFEL');
  assert.ok(!body.reply.includes('{{'), 'variaveis preenchidas');
  ok('G5 nicho trufas → secao 5.6');
}

// G6 — "ta caro" → 5.11 (ancoragem + risk reversal), sem desconto inventado
{
  const { body } = await send('ta caro');
  assert.equal(body.intent, 'kb_rag_reply');
  assert.ok(/caf[eé] por dia|garantia de 7 dias/i.test(body.reply), 'resposta 5.11');
  assert.ok(!/\d+% ?off|cupom|desconto de/i.test(body.reply), 'sem desconto inventado');
  ok('G6 ta caro → secao 5.11');
}

// G7 — "vou pensar" → 5.12 (diagnostico + porta aberta)
{
  const { body } = await send('vou pensar');
  assert.equal(body.intent, 'kb_rag_reply');
  assert.ok(/decida com calma|o que pesou mais/i.test(body.reply), 'resposta 5.12');
  ok('G7 vou pensar → secao 5.12');
}

// G8 — xingamento 2x → irritado_ack e depois handoff humano
{
  await send('/start ' + dom, chat2);
  const r1 = await send('isso e uma porcaria', chat2);
  assert.equal(r1.body.intent, 'irritado_ack', '1a ocorrencia ack');
  const r2 = await send('isso e uma porcaria', chat2);
  assert.equal(r2.body.intent, 'handoff_irritado', '2a ocorrencia handoff');
  assert.equal(Number(redisCommand('GET', 'tg:handoff:' + chat2).result || 0), 1, 'tg:handoff ativo');
  assert.ok(!/\/pay\?/.test(String(r1.body.reply) + String(r2.body.reply)), 'zero link em reclamacao');
  ok('G8 irritado 2x → handoff');
}

// G9 — pergunta fora do KB → playbook_fallback + faq_candidates registrado
{
  const before = Number(redisCommand('LLEN', 'faq_candidates:' + dom).result || 0);
  const { body } = await send('voce aceita criptomoeda bitcoin?');
  assert.equal(body.intent, 'playbook_fallback', 'menu em vez de invencao');
  assert.ok(body.buttons && body.buttons.length >= 3, 'botoes de menu');
  const after = Number(redisCommand('LLEN', 'faq_candidates:' + dom).result || 0);
  assert.ok(after > before, 'faq_candidates registrado (' + before + ' → ' + after + ')');
  const candRaw = redisCommand('LRANGE', 'faq_candidates:' + dom, '0', '0').result;
  const cand = JSON.parse((Array.isArray(candRaw) && candRaw[0]) || '{}');
  assert.ok(cand.q && /criptomoeda/.test(cand.q), 'candidato com a pergunta');
  ok('G9 fora do KB → fallback + faq_candidates');
}

// G10 — garantia → resposta SEM link
{
  const { body } = await send('qual a garantia?');
  assert.equal(body.intent, 'guarantee_inquiry');
  assert.ok(!/\/pay\?/.test(body.reply), 'garantia sem pay-link');
  assert.ok(/7 dias/.test(body.reply), 'garantia real do cadastro');
  ok('G10 garantia sem link');
}

// G11 — regras_do_lojista > KB (hierarquia no systemNote)
{
  harnessFaults.lastPrompt = '';
  configureHarness({ llmQueue: ['{"intent":"duvida","reply":"Tudo certo por aqui."}'] });
  const { body } = await send('posso cancelar depois?');
  configureHarness({ llmQueue: [] });
  assert.equal(body.intent, 'llm_duvida', 'caminho LLM com contrato');
  const p = harnessFaults.lastPrompt || '';
  assert.ok(p.includes('REGRAS DO LOJISTA'), 'regras no prompt');
  assert.ok(p.includes('nunca oferecer desconto sem autorizacao'), 'regra real no prompt');
  assert.ok(p.includes('PROIBICOES DO LOJISTA'), 'proibicoes no prompt');
  assert.ok(p.includes('BASE DE CONHECIMENTO'), 'KB injetada');
  assert.ok(p.indexOf('REGRAS DO LOJISTA') < p.indexOf('BASE DE CONHECIMENTO'), 'regras ANTES da KB (hierarquia MAFEL §10)');
  ok('G11 regras do lojista sobrescrevem KB');
}

// G12 — duas mensagens identicas seguidas → uma unica bolha (dedup 10 min)
{
  await send('/start ' + dom, chat3);
  const a = await send('qual o preco?', chat3);
  const b = await send('qual o preco?', chat3);
  assert.notEqual(a.body.status, 'deduped', 'primeira enviada');
  assert.equal(b.body.status, 'deduped', 'segunda identica deduplicada');
  assert.equal(b.body.intent, 'price_inquiry', 'dedup preserva intent');
  ok('G12 mensagens identicas → 1 bolha');
}

console.log('MAFEL GOLDEN PASS ' + pass + '/14');
if (pass !== 14) { console.error('esperado 14, veio ' + pass); process.exit(1); }
