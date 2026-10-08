import { loadPersonas, simulateConversation } from './simulate-conversation.js';

export async function runAllPersonas(options = {}) {
  const results = [];
  for (const persona of loadPersonas()) {
    results.push(await simulateConversation(persona, { domain: options.domain || `sim-${persona.id}.chat` }));
  }
  const summary = results.reduce((acc, result) => {
    for (const key of ['personas_run', 'turns', 'passed', 'failed', 'wins', 'fallback_turns', 'unexpected_failures']) acc[key] += Number(result.report[key] || 0);
    return acc;
  }, { personas_run: 0, turns: 0, passed: 0, failed: 0, wins: 0, fallback_turns: 0, unexpected_failures: 0, deterministic: true });
  summary.win_rate = summary.personas_run ? Number((summary.wins / summary.personas_run).toFixed(4)) : 0;
  summary.failure_rate = summary.turns ? Number((summary.failed / summary.turns).toFixed(4)) : 0;
  return { summary, results };
}

if (process.argv[1] && process.argv[1].endsWith('run-all-personas.js')) {
  try {
    const output = await runAllPersonas();
    console.log(JSON.stringify(output, null, 2));
    if (output.summary.unexpected_failures > 0) process.exitCode = 1;
  } catch (error) {
    console.error(`simulator batch failed unexpectedly: ${error.message}`);
    process.exitCode = 1;
  }
}
