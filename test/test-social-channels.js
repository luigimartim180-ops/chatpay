import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeRequest, redisCommand, seedRedis } from './harness.js';

let pass = 0;
function ok(name) { pass++; console.log('PASS ' + name); }

console.log('\n================================================================');
console.log('⚡ TESTE DE CANAIS SOCIAIS: Instagram, YouTube, TikTok & Hunter Lead');
console.log('================================================================\n');

// 1. Static Markers Check
const workerCode = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8');
assert.ok(workerCode.includes('/api/hunter-lead'), 'hunter-lead endpoint present');
assert.ok(workerCode.includes('/webhook/instagram'), 'instagram webhook present');
assert.ok(workerCode.includes('/webhook/youtube'), 'youtube webhook present');
assert.ok(workerCode.includes('/webhook/tiktok'), 'tiktok webhook present');
assert.ok(workerCode.includes('loadChannelsUI'), 'loadChannelsUI in dashboard JS present');
assert.ok(workerCode.includes('saveChannelUI'), 'saveChannelUI in dashboard JS present');
ok('1. Static markers validated');

// 2. Provision store
const started = await (await makeRequest('POST', '/start', {
  domain: 'loja.social',
  brand: 'Loja Social AI',
  email: 'social@example.com'
})).json();
assert.ok(started.token, 'token issued');
const dom = 'loja.social';
seedRedis('swarm:prods:' + dom, [{ id: 101, name: 'Produto Social', cents: 4700, deliver: '/ok' }]);
ok('2. Store provisioned for social tests');

// 3. Test POST /api/hunter-lead (Instagram Lead)
let res = await makeRequest('POST', '/api/hunter-lead', {
  dom: 'loja.social',
  user: 'ig_user_123',
  platform: 'instagram',
  msg: 'quanto custa o produto?'
});
assert.equal(res.status, 200, 'hunter lead accepted');
let leadData = await res.json();
assert.equal(leadData.status, 'lead_captured');
assert.equal(leadData.platform, 'instagram');
assert.ok(leadData.intent, 'intent classified');
assert.ok(leadData.pay_link.includes('loja.social'), 'pay link generated');
assert.equal(leadData.should_reply, true, 'should reply on purchase/info question');
ok('3. POST /api/hunter-lead processes Instagram lead with AI reply');

// 4. Test POST /api/hunter-lead (YouTube Live Comment)
res = await makeRequest('POST', '/api/hunter-lead', {
  dom: 'loja.social',
  user: 'yt_viewer_99',
  platform: 'youtube',
  msg: 'quero comprar no pix!'
});
assert.equal(res.status, 200);
leadData = await res.json();
assert.equal(leadData.status, 'lead_captured');
assert.equal(leadData.platform, 'youtube');
assert.ok(leadData.should_reply, 'should reply to buying intent');
ok('4. POST /api/hunter-lead processes YouTube Live lead');

// 5. Test POST /api/hunter-lead (TikTok Comment)
res = await makeRequest('POST', '/api/hunter-lead', {
  dom: 'loja.social',
  user: 'tt_follower_7',
  platform: 'tiktok',
  msg: 'tem garantia?'
});
assert.equal(res.status, 200);
leadData = await res.json();
assert.equal(leadData.status, 'lead_captured');
assert.equal(leadData.platform, 'tiktok');
assert.ok(leadData.reply.length > 0, 'reply generated');
ok('5. POST /api/hunter-lead processes TikTok lead');

// 6. Test Instagram Webhook hub.challenge (GET /webhook/instagram)
res = await makeRequest('GET', '/webhook/instagram?hub.mode=subscribe&hub.challenge=test_challenge_12345&hub.verify_token=ig_chatpay');
assert.equal(res.status, 200);
const challengeText = await res.text();
assert.equal(challengeText, 'test_challenge_12345');
ok('6. GET /webhook/instagram echoes hub.challenge');

// 7. Test Instagram Webhook Message (POST /webhook/instagram)
res = await makeRequest('POST', '/webhook/instagram?domain=loja.social', {
  object: 'instagram',
  entry: [{
    id: 'page_123',
    messaging: [{
      sender: { id: 'ig_sender_888' },
      message: { text: 'Oi, quero comprar o produto' }
    }]
  }]
});
assert.equal(res.status, 200);
const igWebhookRes = await res.json();
assert.equal(igWebhookRes.status, 'received');
ok('7. POST /webhook/instagram receives message payload');

// 8. Test YouTube Webhook (POST /webhook/youtube)
res = await makeRequest('POST', '/webhook/youtube?domain=loja.social', {
  author: 'canal_lead',
  comment: 'manda o link por favor'
});
assert.equal(res.status, 200);
const ytWebhookRes = await res.json();
assert.equal(ytWebhookRes.status, 'received');
ok('8. POST /webhook/youtube receives comment payload');

// 9. Test TikTok Webhook (POST /webhook/tiktok)
res = await makeRequest('POST', '/webhook/tiktok?domain=loja.social', {
  sender: 'tiktok_buyer',
  comment: 'qual o valor?'
});
assert.equal(res.status, 200);
const ttWebhookRes = await res.json();
assert.equal(ttWebhookRes.status, 'received');
ok('9. POST /webhook/tiktok receives comment payload');

// 10. Check lead storage in Redis
const storedLeadsRaw = redisCommand('LRANGE', 'hunter:leads:loja.social', '0', '10');
assert.ok(storedLeadsRaw.result && storedLeadsRaw.result.length >= 4, 'all leads recorded in hunter:leads');
ok('10. Social leads verified in Redis hunter:leads storage');

console.log('\n================================================================');
console.log(`🎉 ALL ${pass} SOCIAL CHANNELS TESTS PASSED!`);
console.log('================================================================\n');
