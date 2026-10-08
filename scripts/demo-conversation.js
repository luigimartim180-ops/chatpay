import assert from 'node:assert/strict';
import { agentRuns, dumpRedis, makeRequest, seedRedis, worker } from '../test/harness.js';

const domain = 'demo.chat';
const otherDomain = 'other.demo.chat';

async function jsonResponse(response) {
  return response.json();
}

async function createStore(name) {
  const response = await makeRequest('POST', '/start', {
    domain: name,
    brand: name,
    email: `${name}@example.com`
  });
  const data = await jsonResponse(response);
  assert.ok(data.token, `token created for ${name}`);
  seedRedis(`swarm:prods:${name}`, [{ id: 1, name: 'Demo Trial', cents: 9700, deliver: '/start-page' }]);
  return data.token;
}

async function graph(token) {
  const response = await makeRequest('GET', `/api/agent-graph?token=${encodeURIComponent(token)}`);
  assert.equal(response.status, 200);
  return jsonResponse(response);
}

async function runTurn(token, text, expectedIntent, checks) {
  const before = await agentRuns(domain);
  const eventResponse = await makeRequest('POST', '/api/swarm-event', {
    token,
    type: 'whatsapp_intent',
    channel: 'api',
    user: 'demo-user',
    convId: `demo-conversation-${Date.now()}`,
    text
  });
  assert.equal(eventResponse.status, 200);
  await worker.scheduled({ cron: '* * * * *' }, { AI: null }, {});

  const after = await agentRuns(domain);
  const diff = {};
  for (const [agent, count] of Object.entries(after)) {
    const delta = count - (before[agent] || 0);
    if (delta > 0) diff[agent] = delta;
  }
  const items = dumpRedis(`swarm:reply-queue:api:${domain}`).lists;
  const reply = items.length ? JSON.parse(items[0][1][0]) : null;
  assert.equal(reply ? (expectedIntent === 'ignore' ? 'ignore' : expectedIntent) : 'ignore', expectedIntent);
  if (checks) checks(reply);
  console.log(`\n${text}`);
  console.log(`intent: ${expectedIntent}`);
  console.log(`agent:runs diff: ${JSON.stringify(diff)}`);
  console.log(`reply: ${reply ? reply.text : '(nenhuma resposta enviada)'}`);
}

const token = await createStore(domain);
const otherToken = await createStore(otherDomain);
const beforeGraph = await graph(token);
console.log('GRAPH_BEFORE');
console.log(JSON.stringify(beforeGraph, null, 2));

await runTurn(token, 'quanto custa?', 'buy', reply => {
  assert.ok(reply && reply.text.includes('pay?d=demo.chat'));
});
await runTurn(token, 'achei caro', 'objection', reply => {
  assert.ok(reply && /entendo|parece/i.test(reply.text));
  assert.ok(reply && /ativação|automação|acompanhamento|garantia|R\$/i.test(reply.text));
  assert.ok(reply && /garantia|R\$/i.test(reply.text));
});
await runTurn(token, 'serve pra quem começa do zero?', 'info_question', reply => {
  assert.ok(reply && reply.text.includes('pay?d=demo.chat'));
});
await runTurn(token, 'quem sabe depois', 'mild_interest', reply => {
  assert.ok(reply && reply.text.includes('?'));
});
await runTurn(token, 'ta, quero agora', 'buy', reply => {
  assert.ok(reply && reply.text.includes('pay?d=demo.chat'));
  assert.ok(reply && reply.text.includes('lead_id='));
});

const afterGraph = await graph(token);
console.log('\nGRAPH_AFTER');
console.log(JSON.stringify(afterGraph, null, 2));

const crossTenant = await makeRequest('GET', `/api/hunter-analytics?token=${encodeURIComponent(otherToken)}&d=${encodeURIComponent(domain)}`);
assert.equal(crossTenant.status, 403, 'cross-tenant analytics access is rejected');
const crossTenantData = await jsonResponse(crossTenant);
assert.equal(crossTenantData.error, 'domínio não autorizado');
console.log('\nCROSS_TENANT_CHECK');
console.log(JSON.stringify({ status: crossTenant.status, error: crossTenantData.error, requested_domain: domain, token_domain: otherDomain }, null, 2));

console.log('\nDEMO_RESULT: PASS');
