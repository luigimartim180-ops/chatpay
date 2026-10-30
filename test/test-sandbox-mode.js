import assert from 'node:assert/strict';
import vm from 'node:vm';
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
  e2eRunnerAvailable: true,
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
assert.equal(partialStatus.e2eRunnerAvailable, true);
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

const generatedTokenResponse = await worker.fetch(new Request('https://sandbox.test/generate-token?key=test-midas-secret&domain=sandbox.e2e.test'), env, {});
assert.equal(generatedTokenResponse.status, 200);
const generatedToken = (await generatedTokenResponse.json()).token;
const liveDashboardResponse = await worker.fetch(new Request('https://sandbox.test/dash?token=' + encodeURIComponent(generatedToken)), env, {});
assert.equal(liveDashboardResponse.status, 200);
const liveDashboard = await liveDashboardResponse.text();
assert.match(liveDashboard, /window\.CHATPAY_ENV = 'staging'/);
assert.match(liveDashboard, /requestedMode !== 'demo'/, 'the dashboard defaults to the real Worker data path');
assert.match(liveDashboard, /window\.CHATPAY_ENV === 'staging' \? 'STAGING'/);
assert.match(liveDashboard, /DADOS REAIS · SOMENTE LEITURA/);
assert.match(liveDashboard, /api\/hunter-analytics-v2\?token=/, 'live overview is fetched from an authenticated read API');
assert.match(liveDashboard, /api\/usage-metrics\?token=/, 'live usage metrics are fetched from an authenticated read API');
assert.match(liveDashboard, /api\/pub\?d=/, 'brand and product display uses the public catalog endpoint');
assert.doesNotMatch(liveDashboard, /api\/me\?token=/, 'the preview avoids the sensitive endpoint that returns the token-bearing snippet');
assert.match(liveDashboard, /Desativado na prévia real somente leitura/, 'live mode disables mutating controls');
for (const [index, match] of [...liveDashboard.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].entries()) {
  if (match[1].trim()) assert.doesNotThrow(() => new vm.Script(match[1]), `dashboard inline script ${index + 1} must parse`);
}
const e2eRequest = async (body, requestEnv = env) => worker.fetch(new Request('https://sandbox.test/api/sandbox-e2e', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: generatedToken, ...body })
}), requestEnv, {});
const unconfirmedStart = await e2eRequest({ action: 'start', maxTurns: 10 });
assert.equal(unconfirmedStart.status, 400, 'E2E start requires explicit staging-Redis and zero-cost acknowledgements');
const overLimitStart = await e2eRequest({ action: 'start', maxTurns: 11, confirmStagingRedis: true, confirmZeroCost: true });
assert.equal(overLimitStart.status, 400, 'E2E hard limit is 10 turns');
const e2eStart = await e2eRequest({ action: 'start', maxTurns: 10, confirmStagingRedis: true, confirmZeroCost: true });
assert.equal(e2eStart.status, 200);
const { runId } = await e2eStart.json();
assert.match(runId, /^[a-f0-9]{32}$/);
const statusOnly = await e2eRequest({ action: 'status', runId });
assert.equal(statusOnly.status, 200);
assert.equal((await statusOnly.json()).totalAiCalls, 0, 'status polling performs no inference');
const outOfOrder = await e2eRequest({ action: 'turn', runId, turn: 2 });
assert.equal(outOfOrder.status, 409, 'turns must be sequential');
const realStart = await e2eRequest({ action: 'start', maxTurns: 1, confirmStagingRedis: true, confirmZeroCost: true });
const realRunId = (await realStart.json()).runId;
const localAI = { async run(model, input) {
  if (model === '@cf/baai/bge-base-en-v1.5') return { data: [[0.1, 0.2]] };
  if (String(input?.prompt || '').includes('Gere somente a próxima mensagem')) return { response: 'Como funciona para uma pequena loja?' };
  return { response: 'É uma solução prática para centralizar conversas no chat.' };
} };
const realTurnResponse = await e2eRequest({ action: 'turn', runId: realRunId, turn: 1 }, { ...env, AI: localAI });
assert.equal(realTurnResponse.status, 200);
const realTurnResult = await realTurnResponse.json();
assert.equal(realTurnResult.status, 'completed');
assert.match(realTurnResult.turn.customer, /Como funciona/);
assert.ok(realTurnResult.turn.agent, 'the Worker pipeline returns a reply with the local AI stub');
assert.equal(realTurnResult.turn.customerAiCalls, 1);
assert.ok(realTurnResult.turn.agentAiCalls >= 1, 'agent-side Workers AI calls are instrumented');
assert.deepEqual(redisCommand('LRANGE', `swarm:reply-queue:sandbox_e2e_${realRunId}:sandbox.e2e.test`, '0', '10').result, [], 'E2E reply is returned to the runner, never queued for a channel');
assert.deepEqual(redisCommand('LRANGE', `lead:sandbox.e2e.test:sandbox_e2e_${realRunId}:touches`, '0', '10').result, [], 'synthetic leads do not schedule future customer touches');
const cancelStart = await e2eRequest({ action: 'start', maxTurns: 2, confirmStagingRedis: true, confirmZeroCost: true });
const cancelRunId = (await cancelStart.json()).runId;
const cancelled = await e2eRequest({ action: 'cancel', runId: cancelRunId });
assert.equal(cancelled.status, 200);
assert.equal((await cancelled.json()).status, 'cancelled');
const cancelledStatus = await e2eRequest({ action: 'status', runId: cancelRunId });
assert.equal((await cancelledStatus.json()).totalAiCalls, 0, 'cancellation between turns consumes no inference');
const cancelledTurn = await e2eRequest({ action: 'turn', runId: cancelRunId, turn: 1 });
assert.equal((await cancelledTurn.json()).status, 'cancelled');
const paidModelStart = await e2eRequest({ action: 'start', maxTurns: 1, confirmStagingRedis: true, confirmZeroCost: true });
const paidModelRunId = (await paidModelStart.json()).runId;
let paidModelAttempts = 0;
const paidModelEnv = { ...env, AI: { async run() { paidModelAttempts += 1; throw Object.assign(new Error('paid model access denied'), { status: 403, code: 5035 }); } } };
const paidModelTurn = await e2eRequest({ action: 'turn', runId: paidModelRunId, turn: 1 }, paidModelEnv);
assert.equal(paidModelTurn.status, 403, 'Paid-only model errors abort with HTTP 403');
assert.equal((await paidModelTurn.json()).abortReason, 'workers_ai_paid_model_blocked');
assert.equal(paidModelAttempts, 1, 'Paid-only model errors never fall back or retry');
const quotaStart = await e2eRequest({ action: 'start', maxTurns: 10, confirmStagingRedis: true, confirmZeroCost: true });
const quotaRunId = (await quotaStart.json()).runId;
const quotaEnv = { ...env, AI: { async run() { throw Object.assign(new Error('daily free neuron allocation exhausted'), { status: 429, code: 3036 }); } } };
const quotaTurn = await e2eRequest({ action: 'turn', runId: quotaRunId, turn: 1 }, quotaEnv);
assert.equal(quotaTurn.status, 429, 'Workers AI quota errors abort the run');
assert.equal((await quotaTurn.json()).abortReason, 'workers_ai_quota');

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

console.log('sandbox guards, E2E orchestration gates (local AI stub) and secret redaction: PASS');
