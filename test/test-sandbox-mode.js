import assert from 'node:assert/strict';
import { harnessFaults, redisCommand, worker } from './harness.js';

const env = {
  REDIS_URL: 'https://current-pheasant-114427.upstash.io',
  REDIS_TOKEN: 'test-redis-token',
  RESEND_KEY: 'test-resend-key',
  TARGET_EMAIL: 'test@example.com',
  MIDAS_SECRET: 'test-midas-secret',
  JWT_SECRET: 'test-jwt-secret',
  SANDBOX_MODE: 'true',
  AI: { async run() { return { response: 'unused' }; } }
};
const statusResponse = await worker.fetch(
  new Request('https://sandbox.test/api/sandbox-status'),
  env,
  {}
);
assert.equal(statusResponse.status, 200);
assert.deepEqual(await statusResponse.json(), {
  sandboxMode: true,
  externalHttpBlocked: true,
  workersAiAllowed: true,
  workersAiBindingConfigured: true,
  configComplete: true,
  missingConfig: [],
  sandboxReady: true,
  e2eRunnerAvailable: false,
  workersAiMaxAttempts: 1,
  workersAiMaxTokens: 256
});
const partialStatusResponse = await worker.fetch(new Request('https://sandbox.test/api/sandbox-status'), {
  SANDBOX_MODE: 'true',
  MIDAS_SECRET: 'not-returned',
  JWT_SECRET: 'not-returned',
  AI: { async run() { return { response: 'unused' }; } }
}, {});
assert.equal(partialStatusResponse.status, 200, 'status endpoint remains available with incomplete optional sandbox config');
const partialStatus = await partialStatusResponse.json();
assert.equal(partialStatus.sandboxMode, true);
assert.deepEqual(partialStatus.missingConfig, ['REDIS_URL', 'REDIS_TOKEN']);
assert.equal(partialStatus.sandboxReady, false);
assert.equal(partialStatus.e2eRunnerAvailable, false);
assert.equal(JSON.stringify(partialStatus).includes('not-returned'), false, 'status reports names, never secret values');
const apiConfirm = await worker.fetch(new Request('https://sandbox.test/api/confirm', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
}), env, {});
assert.equal(apiConfirm.status, 409, 'sandbox refuses to mark any transaction paid');
const legacyConfirm = await worker.fetch(new Request('https://sandbox.test/confirm?key=test-midas-secret&txid=TEST-123'), env, {});
assert.equal(legacyConfirm.status, 409, 'legacy confirmation is blocked too');
const charge = await worker.fetch(new Request('https://sandbox.test/chatpay/charge', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: 97, desc: 'synthetic test' })
}), env, {});
assert.equal(charge.status, 202, 'sandbox does not create Pix/MP charges');
assert.deepEqual(await charge.json(), { status: 'would_create_payment', sandbox: true });
const staticPix = await worker.fetch(new Request('https://sandbox.test/pix?amount=97.00'), env, {});
assert.equal(staticPix.status, 202, 'sandbox does not issue static Pix payloads');

const telegramSendsBefore = harnessFaults.telegramSends;
const blocked = await worker.guardedFetch('https://api.telegram.org/botTEST/sendMessage', {
  method: 'POST',
  body: JSON.stringify({ chat_id: 'test-only', text: 'synthetic test' })
});
assert.equal(blocked.status, 403, 'sandbox must block outbound HTTP');
assert.equal(blocked.headers.get('x-chatpay-sandbox'), 'blocked');
assert.deepEqual(await blocked.json(), { status: 'would_send', sandbox: true });
assert.equal(harnessFaults.telegramSends, telegramSendsBefore, 'blocked requests never reach Telegram/fetch');

const aiCalls = [];
const answer = await worker.llm('synthetic, non-customer prompt', {
  AI_MAX_ATTEMPTS: '5',
  AI_MAX_TOKENS: '2048',
  AI: { async run(model, input) { aiCalls.push({ model, input }); return { response: 'resposta de teste' }; } }
}, { task: 'reply' });
assert.equal(answer, 'resposta de teste');
assert.equal(aiCalls.length, 1, 'sandbox limits Workers AI to one model attempt per call');
assert.equal(aiCalls[0].input.max_tokens, 256, 'sandbox caps generation size');

const sandboxProviderCalls = [];
const countExternalProviderBlocks = () => (redisCommand('LRANGE', 'swarm:logs', '0', '499').result || []).filter(raw => {
  try {
    const entry = JSON.parse(raw);
    return entry.event === 'sandbox_would_send' && entry.data?.host === 'api.openai.com';
  } catch { return false; }
}).length;
const openAiBlocksBefore = countExternalProviderBlocks();
const providerReply = await worker.callLLM('synthetic sandbox provider prompt', {
  llm_provider: 'openai', llm_key: 'must-not-be-used', dom: 'sandbox-test'
}, {
  SANDBOX_MODE: 'true', AI_MAX_ATTEMPTS: '5', AI_MAX_TOKENS: '2048',
  AI: { async run(model, input) { sandboxProviderCalls.push({ model, input }); return { response: 'Workers AI response' }; } }
});
assert.equal(providerReply, 'Workers AI response');
assert.equal(sandboxProviderCalls.length, 1, 'sandbox routes configured third-party providers directly to Workers AI');
assert.match(sandboxProviderCalls[0].model, /^@cf\//);
assert.equal(countExternalProviderBlocks(), openAiBlocksBefore, 'sandbox never attempts the configured external LLM provider');

const masked = worker.maskChannelSecrets({
  llm_provider: 'workers_ai',
  llm_model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  llm_key: 'never-return-this',
  webhooks: [{ url: 'https://example.test/hook', secret: 'webhook-secret' }]
});
assert.equal(masked.llm_key_set, true);
assert.equal('llm_key' in masked, false);
assert.equal(masked.webhooks[0].secret_set, true);
assert.equal('secret' in masked.webhooks[0], false);
assert.equal(JSON.stringify(masked).includes('never-return-this'), false);
assert.equal(JSON.stringify(masked).includes('webhook-secret'), false);

console.log('sandbox outbound guard, Workers AI bounds and secret redaction: PASS');
