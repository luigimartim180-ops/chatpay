const BASE = 'https://midas-core.novoronaldo-m.workers.dev';
const H = { 'Content-Type': 'application/json', 'x-telegram-bot-api-secret-token': 'tg__shared' };
const CHAT = 998009360;
let seq = Date.now(); // sequencial unico nesta execucao (evita colisao de tg:seen)

async function send(text) {
  seq += 1;
  const r = await fetch(BASE + '/api/telegram-webhook?domain=_shared', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ update_id: seq, message: { chat: { id: CHAT }, text } })
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

async function sendVoice() {
  seq += 1;
  const r = await fetch(BASE + '/api/telegram-webhook?domain=_shared', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ update_id: seq, message: { chat: { id: CHAT }, voice: { file_id: 'smokefakevoice1', file_size: 4096, mime_type: 'audio/ogg' } } })
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

async function cb(data) {
  seq += 1;
  const r = await fetch(BASE + '/api/telegram-webhook?domain=_shared', {
    method: 'POST',
    headers: H,
    body: JSON.stringify({
      update_id: seq,
      callback_query: {
        id: 'smk' + seq,
        from: { id: CHAT, is_bot: false, first_name: 'Ronaldo' },
        chat_instance: 'smoke3',
        data,
        message: { chat: { id: CHAT }, message_id: 1, text: 'menu' }
      }
    })
  });
  const body = await r.json().catch(() => ({}));
  return { status: r.status, body };
}

const results = [];
function rec(n, name, pass, detail) {
  results.push({ n, name, pass, detail });
  console.log((pass ? 'PASS' : 'FAIL') + ' S' + n + ' ' + name + (detail ? ' | ' + detail : ''));
}
const PAY_RE = /pay\?d=/i;

// S0: limpa handoff residual + bind session
{
  const a = await send('/retomar');
  const b = await send('/start chatpay.oficial');
  rec(0, '/retomar + /start bind', b.status === 200 && (b.body.intent === 'start_bound' || b.body.intent === 'start'),
    'retomar=' + a.body.intent + ' start=' + b.body.intent);
}

// S1: voz (STT) → fallback honesto (arquivo fake nao existe) + 200
{
  const { status, body } = await sendVoice();
  const ok = status === 200 && /audio_failed|voice|audio_too_large/.test(body.intent || '') && String(body.reply || '').length > 0;
  rec(1, 'voz → STT honesto', ok, 'status=' + status + ' intent=' + body.intent + ' reply=' + String(body.reply || '').slice(0, 70));
}

// S2: "paguei" honesto (sem falsa confirmacao)
{
  const { status, body } = await send('paguei, confirmou meu pagamento?');
  const reply = String(body.reply || '');
  const ok = status === 200 && /payment_status|payment_confirmed/.test(body.intent || '')
    && !/Pagamento CONFIRMADO no sistema|verifiquei e esta confirmado/i.test(reply);
  rec(2, 'paguei → honesto (sem fake confirm)', ok, 'intent=' + body.intent + ' reply=' + reply.slice(0, 80));
}

// S3: garantia SEM pay-link (texto livre)
{
  const { body } = await send('qual a garantia?');
  const ok = /guarantee|llm_|product/.test(body.intent || '') && !PAY_RE.test(String(body.reply || ''));
  rec(3, 'garantia SEM link (texto)', ok, 'intent=' + body.intent + ' temLink=' + PAY_RE.test(String(body.reply || '')));
}

// S3b: callback garantia SEM pay-link
{
  const { body } = await cb('garantia');
  const ok = body.intent === 'callback_guarantee' && !PAY_RE.test(String(body.reply || ''));
  rec('3b', 'garantia SEM link (callback)', ok, 'intent=' + body.intent + ' temLink=' + PAY_RE.test(String(body.reply || '')));
}

// S4: comprar COM link dinamico &p=
{
  const { body } = await send('quero comprar agora');
  const reply = String(body.reply || '');
  const ok = /intent_compra|price_inquiry|llm_|potential_buy/.test(body.intent || '') && PAY_RE.test(reply);
  const hasP = /&p=\d+/.test(reply);
  rec(4, 'comprar COM link &p=', ok && hasP, 'intent=' + body.intent + ' p=' + hasP + ' reply=' + reply.slice(0, 110));
}

// S4b: callback comprar COM link &p=
{
  const { body } = await cb('comprar');
  const reply = String(body.reply || '');
  const ok = body.intent === 'callback_buy' && PAY_RE.test(reply) && /&p=\d+/.test(reply);
  rec('4b', 'callback comprar COM link &p=', ok, 'temLink=' + PAY_RE.test(reply) + ' p=' + /&p=\d+/.test(reply));
}

// S5: pergunta so-doc (KB: secao Cancelamento) → kb_rag_reply em vez de fallback
{
  const { body } = await send('cancelar assinatura pelo painel depois da contratacao?');
  const reply = String(body.reply || '');
  const ok = body.intent === 'kb_rag_reply' && reply.length > 20 && !reply.includes('{{');
  rec(5, 'pergunta so-doc → KB (kb_rag_reply)', ok, 'intent=' + body.intent + ' reply=' + reply.slice(0, 90));
}

// S6: preco mantem valor (regressao)
{
  const { body } = await send('qual o preco?');
  const ok = /price/i.test(body.intent || '') && /97|R\$|pre/i.test(String(body.reply || ''));
  rec(6, 'preco com valor', ok, 'intent=' + body.intent);
}

// S7: produto SEM pay-link
{
  const { body } = await send('qual o nome do seu produto?');
  const reply = String(body.reply || '');
  const ok = body.intent === 'product_info' && !PAY_RE.test(reply);
  rec(7, 'produto SEM link', ok, 'intent=' + body.intent + ' temLink=' + PAY_RE.test(reply));
}

const failed = results.filter(r => !r.pass);
console.log('\nSMOKE3 ' + (results.length - failed.length) + '/' + results.length + (failed.length ? ' FAIL: ' + failed.map(f => 'S' + f.n).join(',') : ' ALL PASS'));
process.exit(failed.length ? 1 : 0);
