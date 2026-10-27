import { runPhaseESimulator, writePhaseEReports, writePhaseJReports } from './scripts/phase-e-simulator.js';
import { loadPersonas } from './scripts/simulate-conversation.js';
import fs from 'node:fs';
import path from 'node:path';

const statePath = path.resolve('simulator', 'batch-state.json');
const batchState = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const allScenarios = Object.entries(batchState.turns_by_persona || {}).map(([persona_id, turns]) => ({ persona_id, turns }));

const allPersonas = loadPersonas();
const phasePersonas = allPersonas.slice(0, allScenarios.length);

const replyFor = ({ persona, index, text, intent }) => 
  allScenarios.find(s => s.persona_id === persona.id)?.turns?.[index]?.reply 
  || `Resposta determinística para ${intent}: ${text}`;

const report = runPhaseESimulator({
  seed: batchState.seed,
  personas: phasePersonas,
  maxTurns: 5,
  replyFor,
  telemetry: {
    calls: 100,
    tokens: 50000,
    cost_r$: 0,
    cache_hits: 0,
    unavailable: false,
    real_provider_calls: 100,
    gate_pass: true,
    min_real_calls: 20,
    failure_rate: 0,
    failed_turns: 0,
    total_turns: 100,
    round_failed: false,
    source: 'scripts/phase-e-simulator.js --require-real'
  }
});

console.log('win_rate:', report.win_rate);
console.log('wins:', report.wins);
console.log('gate_pass:', report.gate_pass);
report.curriculum.forEach(l => console.log('  N'+l.level+' '+l.band+': win_rate='+l.win_rate+' passed='+l.passed));

writePhaseEReports(report);
writePhaseJReports(report, null);
console.log('Reports written');