/**
 * test-v24-ux-edge.js — UX-FAST Checkout: testes de casos extremos
 *
 * Cenários cobertos:
 *  E1  /pay sem email       → campo buyer_email fica vazio; página /pay tem validação HTML
 *  E2  email inválido       → buyer_email salvo literalmente; payPage tem type=email
 *  E3  polling timeout 3min → tx permanece pending após 3 min (< 24h)
 *  E4  tx expirada          → status expired (> 24h) + payPage contém handler de regenerar QR
 *  E5  /pay?tx= já paga     → tx-status retorna paid imediatamente (sem polling)
 *  E6  paid durante polling → redis SET paid → próxima chamada retorna paid
 *
 * Obs: validações de email (E1/E2) são front-end-only no /pay.
 */
import assert from 'node:assert/strict';
import { makeRequest, seedRedis, dumpRedis } from './test/harness.js';

const ok = (name) => console.log(`PASS ${name}`);
const D = 'v24.edge.chatpay';

// Setup: loja com produto
const started = await (await makeRequest('POST', '/start', {
  domain: D, brand: 'V24 Edge', email: 'edge@test.com'
})).json();
assert.ok(started.token, 'token presente');
const token = started.token;
seedRedis(`swarm:prods:${D}`, JSON.stringify([{ id: 1, name: 'Produto Edge', cents: 9700, deliver: '/ok' }]));

// E1: /pay — pagina contém campo email obrigatório
{
  const res = await makeRequest('GET', '/pay');
  assert.equal(res.status, 200, '/pay responde 200');
  const html = await res.text();
  const hasEmailInput = html.includes('type="email"') || html.includes("type='email'") || html.includes('type=email');
  assert.ok(hasEmailInput, 'payPage tem input type=email');
  const hasRequired = html.includes('required');
  assert.ok(hasRequired, 'payPage tem atributo required');
  ok('E1: /pay contem campo email obrigatorio');
}

// E1b: charge sem buyer_email -> salva string vazia no redis
{
  const charge = await (await makeRequest('POST', '/chatpay/charge', {
    token, dom: D, amount: '97.00', desc: 'Sem email', demo: '1'
  })).json();
  assert.ok(charge.txid, 'charge sem email gera txid (gate e front-end)');
  const raw = dumpRedis('pix:tx:' + charge.txid);
  const entry = raw.values.find(([k]) => k === 'pix:tx:' + charge.txid);
  assert.ok(entry, 'entrada pix:tx gravada no redis');
  const tx = JSON.parse(entry[1]);
  assert.equal(tx.buyer_email || '', '', 'buyer_email ausente -> string vazia no redis');
  ok('E1b: charge sem buyer_email -> redis salva string vazia');
}

// E2: emails invalidos -> salvos literalmente, payPage tem validacao type=email
{
  for (const badEmail of ['abc', 'a@b']) {
    const charge = await (await makeRequest('POST', '/chatpay/charge', {
      token, dom: D, amount: '97.00', desc: 'Email invalido', buyer_email: badEmail, demo: '1'
    })).json();
    assert.ok(charge.txid, `charge com email "${badEmail}" gera txid`);
    const raw = dumpRedis('pix:tx:' + charge.txid);
    const entry = raw.values.find(([k]) => k === 'pix:tx:' + charge.txid);
    const tx = JSON.parse(entry[1]);
    assert.equal(tx.buyer_email, badEmail, `buyer_email "${badEmail}" salvo literalmente`);
  }
  const html = await (await makeRequest('GET', '/pay')).text();
  const hasEmailGate = html.includes('type="email"') || html.includes("type='email'") || html.includes('type=email');
  assert.ok(hasEmailGate, 'payPage valida email via type=email no browser');
  ok('E2: emails invalidos salvos; validacao e front-end via type=email');
}

// E3: polling timeout 3 min -> tx pending persiste (nao expira antes de 24h)
{
  const charge = await (await makeRequest('POST', '/chatpay/charge', {
    token, dom: D, amount: '97.00', desc: 'Timeout polling', buyer_email: 'poll@test.com', demo: '0'
  })).json();
  const txid = charge.txid;
  const threeMinAgo = new Date(Date.now() - 180000).toISOString();
  seedRedis('pix:tx:' + txid, JSON.stringify({
    amount: '97.00', status: 'pending', created: threeMinAgo,
    buyer_email: 'poll@test.com', rail: 'pix_estatico', dom: D
  }));
  const statusRes = await (await makeRequest('GET', '/api/tx-status?tx=' + txid)).json();
  assert.equal(statusRes.status, 'pending', 'apos 3 min tx ainda esta pending');
  ok('E3: polling timeout 3min -> tx permanece pending');
}

// E4: tx expirada (>24h) -> status expired + payPage tem handler de regenerar QR
{
  const charge = await (await makeRequest('POST', '/chatpay/charge', {
    token, dom: D, amount: '97.00', desc: 'Expirada', buyer_email: 'expired@test.com', demo: '0'
  })).json();
  const txid = charge.txid;
  const oldDate = new Date(Date.now() - 90000000).toISOString();
  seedRedis('pix:tx:' + txid, JSON.stringify({
    amount: '97.00', status: 'pending', created: oldDate,
    buyer_email: 'expired@test.com', rail: 'pix_estatico', dom: D
  }));
  const statusRes = await (await makeRequest('GET', '/api/tx-status?tx=' + txid)).json();
  assert.equal(statusRes.status, 'expired', 'tx antiga (>24h) retorna expired');
  const html = await (await makeRequest('GET', '/pay')).text();
  const hasExpiredHandler =
    html.includes('expired') || html.includes('regenerar') ||
    html.includes('novo QR') || html.includes('novoQR') ||
    html.includes('newQR') || html.includes('Expirou') ||
    html.includes('expirou');
  assert.ok(hasExpiredHandler, 'payPage contem handler para estado expired');
  ok('E4: tx expirada -> expired; payPage tem handler de regenerar QR');
}

// E5: /pay?tx= de tx ja paga -> tx-status retorna paid imediatamente
{
  const txid = 'PAID' + Date.now().toString().slice(-8);
  seedRedis('pix:tx:' + txid, JSON.stringify({
    amount: '97.00', status: 'paid', paid_at: new Date().toISOString(),
    buyer_email: 'pago@test.com', rail: 'pix_estatico', dom: D
  }));
  const statusRes = await (await makeRequest('GET', '/api/tx-status?tx=' + txid)).json();
  assert.equal(statusRes.status, 'paid', 'tx ja paga -> status paid imediato');
  assert.ok(!['pending', 'expired', 'not_found'].includes(statusRes.status), 'sem estado intermediario');
  ok('E5: /pay?tx= ja paga -> tx-status paid imediatamente');
}

// E6: paid durante polling -> proxima chamada retorna paid (pagina vira sozinha)
{
  const charge = await (await makeRequest('POST', '/chatpay/charge', {
    token, dom: D, amount: '97.00', desc: 'Polling paid', buyer_email: 'polling@test.com', demo: '0'
  })).json();
  const txid = charge.txid;

  const poll1 = await (await makeRequest('GET', '/api/tx-status?tx=' + txid)).json();
  assert.equal(poll1.status, 'pending', 'poll#1: ainda pending');

  seedRedis('pix:tx:' + txid, JSON.stringify({
    amount: '97.00', status: 'paid', paid_at: new Date().toISOString(),
    buyer_email: 'polling@test.com', rail: 'pix_estatico', dom: D
  }));

  const poll2 = await (await makeRequest('GET', '/api/tx-status?tx=' + txid)).json();
  assert.equal(poll2.status, 'paid', 'poll#2: apos seed paid -> retorna paid');
  assert.notEqual(poll2.status, 'pending', 'poll#2 nao retorna pending');
  assert.notEqual(poll2.status, 'expired', 'poll#2 nao retorna expired');
  ok('E6: paid durante polling -> proxima chamada retorna paid');
}

console.log('\nALL EDGE TESTS PASSED');
