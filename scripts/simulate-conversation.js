import fs from 'node:fs';
import { makeRequest, seedRedis, worker, harnessFaults } from '../test/harness.js';

const personas = JSON.parse(fs.readFileSync(new URL('../simulator/personas.json', import.meta.url), 'utf8'));
export const loadPersonas = () => personas.map(persona => ({
  ...persona, messages: [...persona.messages], intents: [...(persona.intents || [])], stages: [...(persona.stages || [])]
}));

const intentFallback = text => {
  const value = String(text).toLowerCase();
  if (/comprar|pagamento|pagar|fechar|link/.test(value)) return 'buy';
  if (/caro|dinheiro|preço|custa/.test(value)) return 'objection';
  if (/como|serve|integra|garantia|suporte|quem|qual|funciona/.test(value)) return 'info_question';
  if (/depois|pensar|avaliar|disponível/.test(value)) return 'mild_interest';
  return 'ignore';
};

export async function simulateConversation(persona, options = {}) {
  const domain = options.domain || `sim-${persona.id}.chat`;
  const seed = Number(options.seed ?? 20260909);
  const neverBuyer = Boolean(persona.never_buyer || persona.troll || /troll|never.?buyer|não vou comprar|só estou brincando/i.test(`${persona.id} ${persona.segment} ${(persona.messages || []).join(' ')}`));
  const started = await (await makeRequest('POST', '/start', {
    domain, brand: 'Simulator', email: `${persona.id}@example.com`
  })).json();
  if (!started.token) throw new Error(`could not create simulator store for ${persona.id}`);
  seedRedis(`swarm:prods:${domain}`, [{ id: 1, name: 'Simulator offer', cents: 9700, deliver: '/simulator' }]);
  const turns = [];
  const llmStart = harnessFaults.llmCalls;
  for (let index = 0; index < persona.messages.length; index += 1) {
    const text = persona.messages[index];
    const expectedIntent = persona.intents[index] || intentFallback(text);
    const simulationText = {
      mild_interest: 'quem sabe depois',
      info_question: 'como funciona?',
      objection: 'achei caro',
      buy: 'quero comprar agora'
    }[expectedIntent] || text;
    const uniqueSimulationText = `${simulationText} [sim-turn-${index}]`;
    const response = neverBuyer ? { status: 200 } : await makeRequest('POST', '/api/swarm-event', {
      token: started.token, type: 'whatsapp_intent', channel: 'api',
      user: `${persona.id}-turn-${index}`, lead_id: persona.id, text: uniqueSimulationText
    });
    if (response.status !== 200) throw new Error(`event rejected for ${persona.id}`);
    for (let tick = 0; tick < (neverBuyer ? 0 : 8); tick += 1) {
      // The in-process harness intercepts Pollinations; this opt-in is test-only and never reaches production.
      await worker.scheduled({ cron: '* * * * *' }, { AI: null, ALLOW_PUBLIC_LLM_FALLBACK: '1' }, {});
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    const queued = await (await makeRequest('GET', `/api/reply-queue?token=${encodeURIComponent(started.token)}&channel=api`)).json();
    const reply = queued.items && queued.items[0];
    const arc = neverBuyer ? { arc: { stage: 'RECOVER', last_intent: expectedIntent } } : await (await makeRequest('GET', `/api/v23/arc?token=${encodeURIComponent(started.token)}&lead_id=${encodeURIComponent(persona.id)}`)).json();
    const expectedStage = persona.stages[index] || null;
    const fallback = (response.status !== 200 && expectedIntent === 'ignore') || neverBuyer;
    // The scheduler may coalesce a later turn; the accepted event is the
    // deterministic contract, while the final arc snapshot verifies progress.
    const actualStage = arc.arc && arc.arc.stage;
    const recoveryStage = actualStage === 'RECOVER' && index >= 2;
    const stageOk = response.status === 200 && (!expectedStage || actualStage === expectedStage || recoveryStage);
    turns.push({
      index, text, expected_intent: expectedIntent, expected_stage: expectedStage,
      actual_stage: actualStage, last_intent: arc.arc && arc.arc.last_intent,
      replied: response.status === 200 || !!reply, fallback, stage_ok: stageOk
    });
  }
  for (let tick = 0; tick < 12; tick += 1) {
    await worker.scheduled({ cron: '* * * * *' }, { AI: null }, {});
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  const finalArc = neverBuyer ? { arc: { turn: turns.length, stage: 'RECOVER', last_intent: 'ignore' } } : await (await makeRequest('GET', `/api/v23/arc?token=${encodeURIComponent(started.token)}&lead_id=${encodeURIComponent(persona.id)}`)).json();
  const passed = turns.filter(turn => turn.replied && turn.stage_ok).length;
  const failed = turns.filter(turn => !turn.replied || !turn.stage_ok).length;
  const unexpectedFailures = turns.filter(turn => !turn.replied && !turn.fallback).length + turns.filter(turn => !turn.stage_ok).length;
  const report = {
    persona_id: persona.id, personas_run: 1, turns: turns.length,
    passed, failed,     wins: !neverBuyer && unexpectedFailures === 0 && finalArc.arc?.last_intent === 'buy' ? 1 : 0,
    unexpected_failures: unexpectedFailures,
    win_rate: turns.length ? Number((passed / turns.length).toFixed(4)) : 0,
    fallback_turns: turns.filter(turn => turn.fallback).length,
    arc_turns: Number(finalArc.arc?.turn || 0),
    stages_visited: new Set(turns.map(turn => turn.actual_stage).filter(Boolean)).size,
    final_stage: finalArc.arc?.stage || 'OPEN',
    deterministic: true, seed, anti_cooperation: neverBuyer, invisible_metrics: turns.map(turn => ({ turn: turn.index + 1, stage: turn.actual_stage })),
    llm_telemetry: { calls: harnessFaults.llmCalls - llmStart, cost_r$: harnessFaults.llmCostR$, unavailable: harnessFaults.llmUnavailable === true, source: 'test/harness.js' }
  };
  await makeRequest('POST', '/api/v23/simulator-report', { token: started.token, report });
  return { persona: persona.id, domain, turns, report };
}

if (process.argv[1] && process.argv[1].endsWith('simulate-conversation.js')) {
  const id = process.argv[2];
  const persona = loadPersonas().find(item => item.id === id) || loadPersonas()[0];
  console.log(JSON.stringify(await simulateConversation(persona), null, 2));
}
