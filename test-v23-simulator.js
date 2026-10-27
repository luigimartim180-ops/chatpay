import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { makeRequest, worker, redisCommand, harnessFaults } from './test/harness.js';
import { loadPersonas, simulateConversation } from './scripts/simulate-conversation.js';
import { GRAPH_NODES, CURRICULUM, HUMANIZATION_SCENARIOS, runPhaseESimulator, simulateAdversarialPersona } from './scripts/phase-e-simulator.js';
import { createProviderChain, generateWithProviders, runProviderSimulation } from './scripts/llm-providers.js';

const personas = loadPersonas();
assert.ok(personas.length >= 20);
assert.ok(personas.every(persona => persona.id && persona.messages.length >= 5));
const store = await (await makeRequest('POST', '/start', {
  domain: 'simulator-test.chat', brand: 'Simulator', email: 'simulator@example.com'
})).json();
assert.ok(store.token);
const first = await simulateConversation(personas[0], { domain: 'simulator-test.chat' });
assert.equal(first.report.deterministic, true);
assert.equal(first.report.turns, personas[0].messages.length);
assert.equal(first.report.unexpected_failures, 0);
assert.equal(first.report.wins, 1);
assert.ok(first.report.arc_turns >= 1);
assert.ok(first.report.stages_visited >= 3);
assert.ok(new Set(first.turns.map(turn => turn.actual_stage)).size >= 3);
const report = await (await makeRequest('GET', `/api/v23/simulator-report?token=${encodeURIComponent(store.token)}`)).json();
assert.equal(report.deterministic, true);
assert.equal(report.personas_run, 1);
assert.equal(report.win_rate, 1);
assert.equal((await makeRequest('GET', '/api/v23/simulator-report')).status, 401);
const phaseE = runPhaseESimulator({
  seed: 23,
  personas: personas.slice(0, 3),
  telemetry: {
    calls: harnessFaults.llmCalls,
    cost_r$: harnessFaults.llmCostR$,
    unavailable: harnessFaults.llmUnavailable,
    expected: true,
    gate_pass: harnessFaults.llmCalls > 0 && harnessFaults.llmCostR$ > 0
  }
});
assert.equal(GRAPH_NODES.length, 8);
assert.equal(CURRICULUM.length, 10);
assert.ok(HUMANIZATION_SCENARIOS.length >= 8);
assert.equal(phaseE.seed, 23);
assert.equal(phaseE.anti_cooperation.never_buyer_wins, 0);
assert.notEqual(phaseE.win_rate, 1);
assert.equal(runPhaseESimulator({ seed: 23, personas: personas.slice(0, 3) }).win_rate, phaseE.win_rate);
const troll = simulateAdversarialPersona({ id: 'troll', troll: true, messages: ['quero comprar agora'], intents: ['buy'] }, { seed: 23 });
assert.equal(troll.won, false);
assert.ok(troll.invisible_metrics[0].quality >= 0);
assert.equal(troll.hunter_desisted_elegantly, true);
const neverBuyer = simulateAdversarialPersona({
  id: 'never-buyer', never_buyer: true, messages: ['vou voltar em 7 dias, lembra da garantia?'], intents: ['mild_interest']
}, { seed: 23 });
assert.equal(neverBuyer.won, false);
assert.equal(neverBuyer.memory.returned_with_memory, true);
assert.ok(neverBuyer.metrics.cadence_scheduled >= 1);
assert.ok(phaseE.curriculum.some(level => level.win_rate < level.min_win_rate || level.win_rate > level.max_win_rate));
assert.equal(phaseE.gate_pass, false);
assert.ok(Array.isArray(phaseE.top_risk_moments));
assert.ok(phaseE.curriculum.every(level => level.violations >= 0));
assert.ok(phaseE.curriculum.some(level => !level.passed));
assert.equal(phaseE.llm_telemetry.gate_pass, true);
assert.equal(phaseE.llm_telemetry.unavailable, false);
assert.ok(phaseE.bandit.every(arm => arm.reward >= 0 && arm.reward <= 1 && arm.exploration_trials_per_arm === 50));
assert.ok(phaseE.scout_unknowns >= 1);
assert.ok(phaseE.paid_reconciliation === true || phaseE.paid_events.length === 0);
const decisionUnauthorized = await makeRequest('GET', '/api/v23/decision-report');
assert.equal(decisionUnauthorized.status, 401);
const decisionAuthorized = await (await makeRequest('GET', `/api/v23/decision-report?token=${encodeURIComponent(store.token)}`)).json();
assert.deepEqual(decisionAuthorized.sections, ['Resumo executivo', 'Gates F1-F8', 'Pagamentos e reconciliação', 'Bandit e lições', 'Sugestões regression-gated', 'Scout desconhecidos', 'Limitações e evidências']);
const charge = await (await makeRequest('POST', '/chatpay/charge', { token: store.token, amount: 9.7, demo: true, lead_id: 'sim-paid' })).json();
await makeRequest('GET', `/confirm?key=test-midas-secret&txid=${encodeURIComponent(charge.txid)}`);
await worker.scheduled({ cron: '* * * * *' }, { AI: null }, {});
const reconciliation = redisCommand('HGETALL', `v23:paid:reconcile:${charge.txid}`).result;
assert.ok(reconciliation.includes('1'));
assert.equal(harnessFaults.llmUnavailable, false);

// FASE G: provider fallback, usage telemetry, deterministic cache and local-only key guard.
const cacheFile = fileURLToPath(new URL('./simulator/test-cache-v23.json', import.meta.url));
try {
  let openRouterCalls = 0;
  let workersCalls = 0;
  const chain = {
    openrouter: async () => { openRouterCalls += 1; throw new Error('OpenRouter HTTP 503'); },
    workers_ai: async () => { workersCalls += 1; return { provider: 'workers_ai', reply: 'fallback', tokens: 7, calls: 1, cost_r$: 0, usage: { total_tokens: 7 } }; },
    pollinations: async () => { throw new Error('must not be reached'); },
    mock: async () => ({ provider: 'mock', reply: 'unavailable', tokens: 1, calls: 1, cost_r$: 0, unavailable: true, usage: { total_tokens: 1 } })
  };
  const firstG = await generateWithProviders('fallback prompt', { seed: 23, turn: 1, provider: 'openrouter', chain, cacheFile });
  const secondG = await generateWithProviders('fallback prompt', { seed: 23, turn: 1, provider: 'openrouter', chain, cacheFile });
  assert.equal(firstG.provider, 'workers_ai');
  assert.equal(firstG.tokens, 7);
  assert.equal(firstG.cost_r$, 0);
  assert.equal(firstG.fallback_errors[0].error, 'OpenRouter HTTP 503');
  assert.equal(openRouterCalls, 1);
  assert.equal(workersCalls, 1);
  assert.equal(secondG.cache_hit, true);
  const gemini = createProviderChain({
    env: { GEMINI_API_KEY: 'sk-test-fixture' },
    fetchImpl: async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'gemini reply' }] } }],
      usageMetadata: { totalTokenCount: 12 }
    }), { status: 200 })
  });
  const geminiResult = await gemini.gemini('hello');
  assert.equal(geminiResult.provider, 'gemini');
  assert.equal(geminiResult.tokens, 12);
  assert.equal(secondG.calls, 0);
  assert.equal(secondG.cost_r$, 0);
  const noKey = createProviderChain({ env: {}, localOnly: true, fetchImpl: async () => { throw new Error('network must not be called'); } });
  assert.equal((await noKey.openrouter('production path')).skipped, true);
  const gReport = await runProviderSimulation({ personas: personas.slice(0, 6), provider: 'mock', personasSubset: 6, maxTurns: 5, seed: 23, cacheFile });
  assert.equal(gReport.personas_run, 6);
  assert.equal(gReport.max_turns, 5);
  assert.ok(gReport.llm_telemetry.tokens > 0);
  assert.equal(gReport.llm_telemetry.unavailable, true);
} finally {
  if (fs.existsSync(cacheFile)) fs.unlinkSync(cacheFile);
}
console.log('V23 Phase E adversarial simulator behavioral cases passed');
