import assert from 'node:assert/strict';
import { configureHarness, harnessFaults, worker } from './harness.js';

const models = Array.from(worker.WORKERS_AI_MODELS);
assert.equal(models[0], '@cf/meta/llama-3.3-70b-instruct-fp8-fast', 'quality-first primary is stable, not random');
assert.equal(models[1], '@cf/qwen/qwen3-30b-a3b-fp8', 'strong reasoning fallback is second');
assert.equal(new Set(models).size, models.length, 'model allowlist has no duplicates');

const taskOrder = Array.from(worker.resolveAIModelOrder({
  AI_MODEL_ORDER_REPLY: `${models[1]},${models[0]},@cf/example/not-allowed`,
  AI_MODEL_ORDER: `${models[2]},${models[0]}`
}, 'reply'));
assert.deepEqual(taskOrder.slice(0, 3), [models[1], models[0], models[2]], 'task/global overrides are allowlisted and deduplicated');
const qualificationOrder = Array.from(worker.resolveAIModelOrder({ AI_MODEL_ORDER_QUALIFICATION: models[4] }, 'qualification'));
assert.deepEqual(qualificationOrder.slice(0, 2), [models[4], models[0]], 'qualification can use its own model priority');
assert.equal(worker.resolveAIModelOrder({ AI_MODEL: '@cf/example/not-allowed' }, 'reply')[0], models[0], 'unknown model IDs are ignored');

assert.equal(worker.extractAIText({ choices: [{ message: { content: '  answer from model  ' } }] }), 'answer from model');
assert.equal(worker.normalizeLLMProvider('openai-gpt-4o-mini'), 'openai');
assert.equal(worker.normalizeLLMProvider('deepseek-reasoner'), 'deepseek_reasoner');
assert.equal(worker.resolveProviderModel('openai', { llm_model: 'gpt-custom' }, { OPENAI_MODEL: 'ignored' }), 'gpt-custom');
assert.equal(worker.resolveProviderModel('anthropic', {}, { ANTHROPIC_MODEL: 'claude-configured' }), 'claude-configured');

const calls = [];
const reply = await worker.llm('Use a fallback if the first model fails.', {
  AI_MAX_ATTEMPTS: '2',
  AI: {
    async run(model) {
      calls.push(model);
      if (calls.length === 1) throw new Error('simulated provider outage');
      return { choices: [{ message: { content: '  resposta resiliente  ' } }] };
    }
  }
}, { task: 'reply' });
assert.equal(reply, 'resposta resiliente');
assert.deepEqual(calls, models.slice(0, 2), 'tries the strongest configured models in order');

const limitedCalls = [];
const unavailable = await worker.llm('No retries beyond the configured bound.', {
  AI_MAX_ATTEMPTS: '1',
  AI: { async run(model) { limitedCalls.push(model); return { response: '' }; } }
});
assert.equal(unavailable, '');
assert.deepEqual(limitedCalls, [models[0]], 'empty output triggers bounded failure, not unbounded retries');

configureHarness({ llmCalls: 0 });
assert.equal(await worker.llm('Sensitive local prompt', {}), '', 'missing Workers AI returns a local empty result');
assert.equal(harnessFaults.llmCalls, 0, 'public inference fallback is not contacted by default');

console.log('quality-first AI router, bounded model fallback and provider overrides: PASS');
