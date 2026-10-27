import assert from 'node:assert/strict';
import { dumpRedis, makeRequest, redisCommand, runScheduled, seedRedis, worker } from './test/harness.js';

const started = await (await makeRequest('POST', '/start', { domain: 'k.chatpay', brand: 'K', email: 'k@example.com' })).json();
assert.ok(started.token);
const auth = body => ({ token: started.token, ...body });
const dom = 'k.chatpay';
seedRedis(`swarm:prods:${dom}`, [{ id: 7, name: 'K Produto', cents: 9700, deliver: '/ok' }]);
let response;

for (const [method, path, body] of [
	['GET', '/api/coupon-config', undefined],
	['POST', '/api/coupon-config', { token: 'abc' }],
	['GET', '/api/group-deal', undefined],
	['POST', '/api/group-deal', { token: 'abc' }],
	['GET', '/api/price-watch', undefined],
	['POST', '/api/price-watch', { token: 'abc' }],
	['GET', '/api/supervision', undefined],
	['POST', '/api/supervision', { token: 'abc' }],
	['GET', '/api/approvals', undefined],
	['POST', '/api/offer-calc', { token: 'abc' }]
]) {
	response = await makeRequest(method, path, body);
	assert.equal(response.status, 401, `${method} ${path} rejects missing/invalid token`);
}
for (const path of ['/api/coupon-config', '/api/group-deal', '/api/price-watch', '/api/supervision', '/api/offer-calc']) {
	response = await makeRequest('POST', path);
	assert.equal(response.status, 400, `POST ${path} rejects missing JSON body`);
}

response = await makeRequest('POST', '/api/coupon-config', auth({ max_per_day: 1, discount_max_pct: 10, validity_minutes: 30, min_ticket_cents: 1000, active: true }));
assert.equal(response.status, 200);
response = await makeRequest('POST', '/api/coupon/issue', auth({ lead_id: 'k-lead', cents: 9700 }));
assert.equal(response.status, 200);
const issued = await response.json();
assert.equal(issued.status, 'issued');
const code = issued.coupon.code;
response = await makeRequest('POST', '/api/coupon/quote', auth({ code, cents: 9700 }));
assert.equal(response.status, 200);
const quote = await response.json();
assert.ok(quote.cents < 9700 && quote.cents >= 0);
response = await makeRequest('POST', '/api/coupon/redeem', auth({ code, cents: 9700 }));
assert.equal(response.status, 200);
response = await makeRequest('POST', '/api/coupon/redeem', auth({ code, cents: 9700 }));
assert.equal(response.status, 400, 'coupon cannot be redeemed twice');
response = await makeRequest('POST', '/api/coupon-config', auth({ max_per_day: 0, discount_max_pct: 10, validity_minutes: 30, min_ticket_cents: 1000, active: true }));
assert.equal(response.status, 200);

response = await makeRequest('POST', '/api/offer-calc', auth({ cents: 1000, parts: 3 }));
assert.equal(response.status, 200);
assert.equal((await response.json()).installment_cents, 333);
response = await makeRequest('POST', '/api/group-deal', auth({ prod_id: 7, group_size: 2, discount_pct: 10, window_hours: 24 }));
const deal = await response.json();
response = await makeRequest('POST', '/api/group-deal/join', auth({ deal_id: deal.deal.id, group_id: 'g', lead_id: 'a' }));
assert.equal(response.status, 200);
response = await makeRequest('POST', '/api/group-deal/join', auth({ deal_id: deal.deal.id, group_id: 'g', lead_id: 'a' }));
assert.equal(response.status, 409);
response = await makeRequest('POST', '/api/group-deal/join', auth({ deal_id: deal.deal.id, group_id: 'g', lead_id: 'b' }));
assert.equal((await response.json()).status, 'complete');

response = await makeRequest('POST', '/api/price-watch', auth({ lead_id: 'watch-lead', prod_id: 7 }));
assert.equal(response.status, 200);
await runScheduled();
assert.equal((dumpRedis(`swarm:reply-queue:api:${dom}`).lists.find(([key]) => key === `swarm:reply-queue:api:${dom}`) || [])[1]?.length || 0, 0, 'no message without price drop');

response = await makeRequest('POST', '/api/checkout/start', auth({ txid: 'KTX1', cents: 9700, lead_id: 'checkout-lead', channel: 'api' }));
assert.equal(response.status, 200);
assert.ok(dumpRedis('swarm:recover').sorted.length >= 1);

response = await makeRequest('POST', '/api/stock', auth({ prod_id: 7, stock: 3 }));
assert.equal(response.status, 200);
assert.equal((await response.json()).stock, 3);

response = await makeRequest('POST', '/api/supervision', auth({ min_ticket_cents: 5000, active: true }));
assert.equal(response.status, 200);
await makeRequest('POST', '/api/swarm-event', auth({ type: 'whatsapp_intent', channel: 'api', user: 'approval-user', lead_id: 'approval-lead', text: 'quero comprar' }));
await runScheduled();
const approvals = (await (await makeRequest('GET', `/api/approvals?token=${encodeURIComponent(started.token)}`)).json()).approvals;
assert.ok(approvals.length >= 1);
response = await makeRequest('POST', `/api/approvals/${approvals[0].id}`, auth({ edited_reply: 'Resposta aprovada pelo especialista.' }));
assert.equal(response.status, 200);

await makeRequest('POST', '/api/recovery', auth({ txid: 'missing-tx' }));
assert.ok(dumpRedis('swarm:recover').sorted.length >= 1);
console.log('V23 K1-K6 anti-fake tests passed');
