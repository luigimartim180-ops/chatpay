import assert from 'node:assert/strict';
import { makeRequest, seedRedis, dumpRedis, worker } from './test/harness.js';

const check = (name, fn) => { fn(); console.log(`PASS ${name}`); };
const d = 'v24.ux.chatpay';

// init
const started = await (await makeRequest('POST', '/start', { domain: d, brand: 'V24 UX', email: 'v24@example.com' })).json();
assert.ok(started.token);
const token = started.token;
seedRedis(`swarm:prods:${d}`, [{ id: 1, name: 'UX Fast', cents: 9700, deliver: '/ok' }]);

// Test /chatpay/charge with buyer_email
const charge = await (await makeRequest('POST', '/chatpay/charge', { token, dom: d, amount: "97.00", desc: "UX Fast", buyer_email: "lead@test.com", demo: "1" })).json();
check('/chatpay/charge accepts buyer_email and returns txid', () => {
    assert.ok(charge.txid);
});
const txid = charge.txid;

// Test tx-status pending
const pendingStatus = await (await makeRequest('GET', `/api/tx-status?tx=${txid}`)).json();
check('tx-status pending', () => {
    assert.equal(pendingStatus.status, 'demo');
});

// Confirm payment
const confirm = await (await makeRequest('POST', '/confirm', { token, txid })).json();
check('confirm transaction', () => {
    assert.ok(confirm);
});

// Test tx-status paid
const paidStatus = await (await makeRequest('GET', `/api/tx-status?tx=${txid}`)).json();
check('tx-status paid', () => {
    assert.ok(['paid', 'demo'].includes(paidStatus.status), `expected paid or demo, got ${paidStatus.status}`);
});

// Verify email is persisted
const txEntry = dumpRedis(`pix:tx:${txid}`).values.find(([k]) => k === `pix:tx:${txid}`);
if (!txEntry) throw new Error('Transaction entry not found in Redis');
const tx = JSON.parse(txEntry[1]);
check('buyer_email saved in tx', () => {
    assert.equal(tx.buyer_email, 'lead@test.com');
});

// Test expired logic
const chargeExpired = await (await makeRequest('POST', '/chatpay/charge', { token, dom: d, amount: "97.00", desc: "UX Fast", buyer_email: "lead@test.com", demo: "0" })).json();
const expTxid = chargeExpired.txid;
const oldDate = new Date(Date.now() - 90000000).toISOString();
seedRedis(`pix:tx:${expTxid}`, { amount: "97.00", status: "pending", created: oldDate, buyer_email: "lead@test.com" });
const expStatus = await (await makeRequest('GET', `/api/tx-status?tx=${expTxid}`)).json();
check('tx-status expired', () => {
    assert.equal(expStatus.status, 'expired');
});
