import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPersonas } from './simulate-conversation.js';
import { REAL_CACHE, REAL_PROVIDERS, RUN_LOG, probeProviders, runProviderSimulation, sortProviderOrderByProbe } from './llm-providers.js';
import { loadLabSecrets } from './secret-loader.js';

export const GRAPH_NODES = ['curioso', 'comparando', 'objeção_preço', 'objeção_confiança', 'quase', 'sumido', 'voltou', 'pago'];
export const CURRICULUM = Array.from({ length: 10 }, (_, i) => ({
  level: i + 1,
  band: i < 3 ? 'easy' : i < 6 ? 'medium' : i < 8 ? 'difficult' : 'adversarial',
  min_win_rate: i < 3 ? 0.6 : i < 6 ? 0.3 : i < 8 ? 0.1 : 0,
  max_win_rate: i < 3 ? 0.9 : i < 6 ? 0.6 : i < 8 ? 0.35 : 0.05,
  gate: i === 0 ? null : i - 1
}));
export function validateBandGates(results, violations = 0) {
  return results.every(level => level.win_rate >= level.min_win_rate && level.win_rate <= level.max_win_rate && level.win_rate !== 1 && level.previous_gate_passed && violations === 0);
}
export const HUMANIZATION_SCENARIOS = [
  { id: 'typo', prompt: 'qro compra?? kero hj', expected: 'interpret' },
  { id: 'emoji-caps', prompt: 'MANDA O LINK 🔥🔥', expected: 'interpret' },
  { id: 'double-message', prompt: 'quanto custa?\\n??', expected: 'dedup' },
  { id: 'audio', prompt: '[áudio 0:12] transcrição: n sei se confio', expected: 'transcribe' },
  { id: 'delay-40m', prompt: '??', expected: 'recover_delay' },
  { id: 'competitor-print', prompt: '[print] concorrente mais barato', expected: 'compare' },
  { id: 'optout', prompt: 'desisti, não me chama mais', expected: 'optout' },
  { id: 'return-3d', prompt: 'voltei, lembra da garantia?', expected: 'memory' }
];

export function createRng(seed = 1) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function isNeverBuyer(persona = {}) {
  const value = `${persona.id || ''} ${persona.name || ''} ${persona.segment || ''} ${(persona.messages || []).join(' ')}`.toLowerCase();
  return Boolean(persona.never_buyer || persona.troll || /troll|never.?buyer|n[aã]o vou comprar|s[oó] estou brincando/.test(value));
}

export function classifyQuality(reply = '', input = '') {
  const text = `${reply} ${input}`.toLowerCase();
  let quality = 0.45;
  if (reply && reply.length >= 20) quality += 0.15;
  if (/como|por que|qual|quando|quanto/.test(input)) quality += /preço|custo|garantia|suporte/.test(reply.toLowerCase()) ? 0.2 : -0.1;
  if (/comprar|pagar|link/.test(input)) quality += /link|pagamento|pix|comprar/.test(text) ? 0.25 : -0.15;
  if (/caro|frustrad|medo/.test(input)) quality += /entendo|garantia|segurança|opção/.test(text) ? 0.15 : -0.1;
  return Math.max(0, Math.min(1, Number(quality.toFixed(4))));
}

function nextNode(node, quality, draw, intent) {
  if (intent === 'buy' && quality >= 0.55) return 'quase';
  if (quality < 0.3) return node === 'quase' ? 'sumido' : 'objeção_confiança';
  const map = {
    curioso: ['comparando', 'objeção_preço'], comparando: ['objeção_preço', 'objeção_confiança'],
    objeção_preço: ['objeção_confiança', 'quase'], objeção_confiança: ['quase', 'sumido'],
    quase: ['pago', 'voltou'], sumido: ['voltou', 'sumido'], voltou: ['quase', 'objeção_confiança'],
    pago: ['pago', 'pago']
  };
  const choices = map[node] || ['curioso', 'comparando'];
  return choices[draw < quality ? 0 : 1];
}

export function simulateAdversarialPersona(persona, { seed = 1, replyFor, level = 10, maxTurns = Infinity } = {}) {
  const rng = createRng(seed);
  const neverBuyer = isNeverBuyer(persona);
  const required = Number(persona.min_objections_before_buy ?? (neverBuyer ? Infinity : level >= 7 ? 3 : level >= 4 ? 2 : 0));
  const objections = persona.objections || ['preço', 'confiança', 'resultado'].slice(0, Number.isFinite(required) ? required : 3);
  let node = 'curioso';
  let resolved = 0;
  let memoryReads = 0;
  let memoryWrites = 0;
  let judgeBlocks = 0;
  let honestyBlocks = 0;
  let cadenciaAgendada = 0;
  let almostLoss = null;
  let previousQuality = 0.3;
  const turns = (persona.messages || []).slice(0, Number.isFinite(maxTurns) ? maxTurns : undefined).map((text, index) => {
    const intent = persona.intents?.[index] || 'ignore';
    const reply = replyFor ? replyFor({ text, intent, index, persona }) : `Entendi. Posso ajudar com ${intent}.`;
    const quality = classifyQuality(reply, text);
    const scoreBefore = previousQuality;
    const draw = rng();
    const target = nextNode(node, quality, draw, intent);
    const evidence = /garantia|seguran[çc]a|prova|depoimento|resultado|detalhes|link|case|sucesso|cliente|exemplo|testemunho|funciona|eficaz|comprovado|retorno|ROI|recomend|confia[nv][çe]l|satisfa[çc][aã]o|benef[íi]cio|economiz|lucro|ganho|investimento|parcel|Pix|cart[aã]o|cupom|desconto|promo[çc][aã]o|oferta|voucher|suporte|atendimento|humano|24h|dispon[íi]vel|urgente|hoje|agora|[úu]ltim|limitad|vagas|reembolso|devolu[çc][aã]o|7\s*dias|teste|trial/i.test(reply);
    if (intent === 'objection' && evidence) resolved += 1;
    if (/voltei|lembra|garantia/i.test(text)) memoryReads += 1;
    memoryWrites += 1;
    if (quality < 0.4) { judgeBlocks += 1; if (/só hoje|últimas|garantido/i.test(reply)) honestyBlocks += 1; if (almostLoss === null) almostLoss = index + 1; }
    const canBuy = intent === 'buy' && resolved >= required && quality >= 0.55;
    const allowedTarget = neverBuyer ? (target === 'sumido' ? 'voltou' : target) : (canBuy && target === 'quase' ? 'pago' : target);
    // L2: Trigger LastMileClose on intermediate stages when score >= 0.5
    const play = (node === 'quase' || (node !== 'pago' && quality >= 0.5 && index > 0)) && quality < 0.6 ? 'LastMileClose' : ['MirrorOpener', 'LabelEmpathy', 'CalibratedQuestion'][index % 3];
    const almostLoss = scoreBefore < 0.4 && quality > 0.6;
    const metrics = {
      turn: index + 1, quality, node_before: node, node_after: allowedTarget,
      transition_probability: Number((quality * 0.7 + 0.2).toFixed(4)),
      rng_draw: Number(draw.toFixed(8)), latency_ms: 20 + Math.floor(rng() * 180),
      token_count: String(reply).length, llm_calls: 0, cost_r$: 0,
      play,
      judge_blocked: quality < 0.4, judge_reason: quality < 0.4 ? 'resposta fraca' : 'ok',
      memory_write: 1, memory_read: /voltei|lembra|garantia/i.test(text) ? 1 : 0,
      cadence_scheduled: 1, cadence_sent: 0, cadence_suppressed: neverBuyer && index === (persona.messages || []).length - 1 ? 1 : 0,
      dedup_hit: /\\n|\\?\\?/.test(text) ? 1 : 0, scout_unknowns: intent === 'ignore' ? 1 : 0
    };
    node = allowedTarget;
    previousQuality = quality;
    return {
      index, input: text, intent, node, quality, metrics,
      turn_number: index + 1, persona: persona.id, level: `N${level}`,
      stage_before: metrics.node_before, stage_after: metrics.node_after,
      lead_message: text, hunter_reply: reply, intent_detected: intent,
      play_selected: play, score_before: scoreBefore, score_after: quality,
      almost_loss: almostLoss, reward_to_play: Number(quality.toFixed(4))
    };
  });
  if (turns.length && !neverBuyer && node !== 'pago') cadenciaAgendada = 1;
  const won = !neverBuyer && node === 'pago' && resolved >= required;
  return {
    persona_id: persona.id, never_buyer: neverBuyer, won, final_node: won ? 'pago' : node,
    min_objections_before_buy: Number.isFinite(required) ? required : 'infinite',
    objections_required: objections, objections_resolved: resolved,
    turns, invisible_metrics: turns.map(t => t.metrics),
    memory: { writes: memoryWrites, reads: memoryReads, returned_with_memory: memoryReads > 0 },
    metrics: {
      latency_p50_ms: turns.length ? turns.map(t => t.metrics.latency_ms).sort((a, b) => a - b)[Math.floor(turns.length / 2)] : 0,
      latency_p95_ms: turns.length ? turns.map(t => t.metrics.latency_ms).sort((a, b) => a - b)[Math.max(0, Math.ceil(turns.length * 0.95) - 1)] : 0,
      llm_calls: 0, tokens: turns.reduce((n, t) => n + t.metrics.token_count, 0), cost_r$: 0,
      judge_blocks: judgeBlocks, honesty_blocks: honestyBlocks,
      cadence_scheduled: turns.length, cadence_sent: 0, cadence_suppressed: turns.filter(t => t.metrics.cadence_suppressed).length,
      dedup_hits: turns.reduce((n, t) => n + t.metrics.dedup_hit, 0),
      scout_unknowns: turns.reduce((n, t) => n + t.metrics.scout_unknowns, 0),
      momento_virada: turns.find(t => t.quality >= 0.6)?.index + 1 || null,
      quase_perda: almostLoss, explore_exploit_ratio: '2:1', play_por_estagio: turns.map(t => ({ stage: t.node, play: t.metrics.play }))
    },
    hunter_desisted_elegantly: neverBuyer && node !== 'pago',
    cadence_respected: neverBuyer,
    reconciliation: {
      persona: persona.id, final_stage: node,
      paid_emitted: node === 'pago', confirm_simulated: node === 'pago',
      reconciled: node === 'pago', win_counted: node === 'pago'
    }
  };
}

export function runPhaseESimulator({ seed = 20260909, personas = loadPersonas(), telemetry = null, maxTurns = Infinity, replyFor } = {}) {
  const adversarial = [
    { id: 'troll-never-buyer', segment: 'troll', never_buyer: true, messages: ['manda o link só para zoar', 'não vou comprar nunca'], intents: ['buy', 'buy'] },
    { id: 'never-buyer', segment: 'never_buyer', never_buyer: true, messages: ['só estou pesquisando', 'não compro'], intents: ['mild_interest', 'buy'] }
  ];
  const scenarioPersonas = [...personas, ...adversarial, { id: 'scout-unknown', messages: ['uma frase sem intenção conhecida'], intents: ['ignore'] }];
  const scenarios = scenarioPersonas.map((persona, i) => simulateAdversarialPersona(persona, { seed: Number(seed) + i, level: 10, maxTurns, replyFor }));
  const wins = scenarios.filter(s => s.won).length;
  const winRate = scenarios.length ? Number((wins / scenarios.length).toFixed(4)) : 0;
  let priorPassed = true;
  const levelRuns = [];
  const levelResults = CURRICULUM.map((level, i) => {
    // L1: Use extended personas for medium/difficult levels (N4+)
    const levelPersonas = i >= 3 ? personas.map(p => ({ ...p, messages: (p.messages_extended || p.messages).slice(0, i < 6 ? 8 : 10) })) : personas;
    const levelScenarios = levelPersonas.map((persona, j) => simulateAdversarialPersona(persona, { seed: Number(seed) + i * 1000 + j, level: level.level, maxTurns: Math.min(maxTurns, i < 6 ? 8 : 10), replyFor }));
    const adversarialScenarios = adversarial.map((persona, j) => simulateAdversarialPersona(persona, { seed: Number(seed) + i * 1000 + personas.length + j, level: level.level, maxTurns, replyFor }));
    levelRuns.push({ level: level.level, scenarios: levelScenarios, adversarial: adversarialScenarios });
    const levelWins = levelScenarios.filter(s => s.won).length;
    const levelRate = levelScenarios.length ? Number((levelWins / levelScenarios.length).toFixed(4)) : 0;
    const violations = adversarialScenarios.filter(s => s.never_buyer && s.won).length;
    const previous_gate_passed = i === 0 || priorPassed;
    const wilson = proportionInterval(levelWins, levelScenarios.length);
    const ciIncludesBand = wilson.low <= level.max_win_rate && wilson.high >= level.min_win_rate;
    const passed = previous_gate_passed && violations === 0 && levelRate >= level.min_win_rate && levelRate <= level.max_win_rate && levelRate !== 1 && ciIncludesBand;
    priorPassed = passed;
    return { ...level, sample_n: levelScenarios.length, win_rate: levelRate, violations, previous_gate_passed, ci95: wilson, ci_includes_band: ciIncludesBand, passed: levelScenarios.length >= 4 ? passed : false, sample_status: levelScenarios.length >= 20 ? 'adequate' : 'amostra insuficiente' };
  });
  const instrumentedScenarios = levelRuns.flatMap(run => run.scenarios);
  const heatmap = instrumentedScenarios.flatMap(s => s.turns.map(t => ({ persona: s.persona_id, stage: t.node === 'pago' ? 'quase_pago' : t.node, quality: t.quality, paid: t.node === 'pago' })));
  const qualityRiskTurns = instrumentedScenarios.flatMap(s => s.turns.map(t => ({ persona: s.persona_id, turn: t.index + 1, fala: t.input, quality: t.quality, score_before: t.score_before, score_after: t.score_after })));
  const risks = qualityRiskTurns.sort((a, b) => a.quality - b.quality).slice(0, 5);
  // L3: Collect exact almost-loss moments (score_before < 0.4, score_after > 0.6)
  const almostLosses = qualityRiskTurns.filter(t => t.score_before < 0.4 && t.score_after > 0.6).sort((a, b) => (b.score_after - b.score_before) - (a.score_after - a.score_before)).slice(0, 10);
  const totalCost = scenarios.reduce((n, s) => n + s.metrics.cost_r$, 0);
  const llmCalls = scenarios.reduce((n, s) => n + s.metrics.llm_calls, 0);
  const actualTelemetry = telemetry || { calls: llmCalls, cost_r$: totalCost, unavailable: true, expected: scenarios.length > 0, gate_pass: !scenarios.length || (llmCalls > 0 && totalCost > 0), source: 'phase-e-simulator' };
  const reconciliation = instrumentedScenarios.map(s => s.reconciliation);
  const paidEvents = reconciliation.filter(item => item.paid_emitted).map(item => ({ txid: `sim-${item.persona}`, emitted: true, confirmed: item.confirm_simulated, reconciled: item.reconciled }));
  const playStats = {};
  for (const scenario of instrumentedScenarios) for (const turn of scenario.turns) {
    const play = turn.play_selected; const stats = playStats[play] || { trials: 0, rewards: [] };
    stats.trials += 1; stats.rewards.push(turn.reward_to_play); playStats[play] = stats;
  }
  const banditByPlay = Object.fromEntries(Object.entries(playStats).map(([play, stats]) => {
    const rewardSum = stats.rewards.reduce((sum, value) => sum + value, 0); const mean = rewardSum / stats.trials;
    const variance = stats.rewards.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / stats.trials;
    return [play, { trials: stats.trials, reward_sum: Number(rewardSum.toFixed(4)), reward_mean: Number(mean.toFixed(4)), reward_std: Number(Math.sqrt(variance).toFixed(4)), ci95: proportionInterval(stats.rewards.filter(value => value >= 0.55).length, stats.trials) }];
  }));
  const riskTurns = instrumentedScenarios.flatMap(s => s.turns.filter(turn => turn.almost_loss).map(turn => ({ persona: s.persona_id, ...turn })));
  const bandit = levelResults.map(level => ({ band: level.band, reward: Number(Math.min(1, Math.max(0, level.win_rate)).toFixed(4)), epsilon: 0.2, exploration_trials_per_arm: 50 }));
  // L2: LastMileClose stats with conversion within 2 turns
  const lastMileActivations = instrumentedScenarios.flatMap(s => s.turns).filter(t => t.play_selected === 'LastMileClose');
  const lastMileConverted = instrumentedScenarios.filter(s => s.won && s.turns.some((turn, idx) => turn.play_selected === 'LastMileClose' && (idx === s.turns.length - 1 || s.turns[idx + 1].quality >= 0.6))).length;
  return {
    phase: 'E', seed: Number(seed), graph_nodes: GRAPH_NODES, graph_node_count: GRAPH_NODES.length,
    curriculum: levelResults, humanization: HUMANIZATION_SCENARIOS,
    personas_run: scenarios.length, wins, win_rate: winRate,
    explicit_win_rate_1_failure: winRate === 1,
    gate_pass: winRate !== 1 && validateBandGates(levelResults, levelResults.reduce((n, level) => n + level.violations, 0)) && actualTelemetry.gate_pass,
    heatmap, top_risk_moments: risks,
    play_effective: scenarios.map(s => ({ persona: s.persona_id, level: 10, play: s.metrics.play_por_estagio[0]?.play || null })),
    cost_r$: Number(totalCost.toFixed(4)), cost_per_win_r$: wins ? Number((totalCost / wins).toFixed(4)) : 0,
    diff_previous_round: { available: false, reason: 'no previous seeded report supplied' },
    anti_cooperation: { never_buyer_count: adversarial.length, never_buyer_wins: scenarios.filter(s => s.never_buyer && s.won).length },
    llm_telemetry: actualTelemetry, paid_events: paidEvents, paid_reconciliation: reconciliation.filter(item => item.paid_emitted).every(item => item.reconciled),
    reconciliation, bandit, bandit_by_play: banditByPlay, top_almost_losses: almostLosses,
    last_mile: { activated: lastMileActivations.length, converted: lastMileConverted, conversion_rate: lastMileActivations.length ? Number((lastMileConverted / lastMileActivations.length).toFixed(4)) : 0 },
    lessons: scenarios.filter(s => s.metrics.quase_perda).map(s => ({ persona: s.persona_id, loss: true, lesson: 'revisar o play no momento de quase-perda' })),
    suggestions: { regression_gated: true, accepted: 0, rejected: 0 },
    scout_unknowns: scenarios.reduce((n, s) => n + s.metrics.scout_unknowns, 0),
    scenarios, diagnostic_turns: instrumentedScenarios.flatMap(s => s.turns), diagnostic_reconciliation: reconciliation
  };
}

function proportionInterval(successes, total) {
  if (!total) return { low: 0, high: 0, level: 0.95 };
  const z = 1.96; const p = successes / total; const denominator = 1 + (z ** 2 / total);
  const centre = (p + (z ** 2 / (2 * total))) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p) / total) + (z ** 2 / (4 * total ** 2)));
  return { low: Number(Math.max(0, centre - margin).toFixed(4)), high: Number(Math.min(1, centre + margin).toFixed(4)), level: 0.95 };
}

function levelResultsPlaceholder() { return true; }

export function writePhaseEReports(report, directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'simulator')) {
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  const heatmap = report.curriculum.map(level => `${level.level}|${level.band}|${level.passed ? 'PASS' : 'FAIL'}`).join('\n');
  const personaHeatmap = report.heatmap.slice(0, 80).map(item => `${item.persona}|${item.stage}|${item.quality}`).join('\n');
  const risks = report.top_risk_moments.map(item => `- ${item.persona} T${item.turn}: "${item.fala}" (score ${item.quality})`).join('\n') || '- nenhum';
  const plays = report.play_effective.slice(0, 20).map(item => `- ${item.persona} (N${item.level}): ${item.play}`).join('\n');
  const markdown = [
    '# FASE E adversarial simulator v2', '',
    `- Seed: ${report.seed}`, `- Personas: ${report.personas_run}`,
    `- Win rate: **${report.win_rate}**`, `- Custo total: R$ ${report.cost_r$}`, `- Custo por win: R$ ${report.cost_per_win_r$}`,
    `- Anti-cooperation: ${report.anti_cooperation.never_buyer_wins} never-buyers won (must be 0)`,
    `- Gate: **${report.gate_pass ? 'PASS' : 'FAIL'}** (win_rate 1.0 is explicitly a failure)`, '',
    '## Curriculum heatmap', '', 'level|band|n|result', report.curriculum.map(level => `${level.level}|${level.band}|${level.sample_n}|${level.sample_status === 'amostra insuficiente' ? 'amostra insuficiente' : (level.passed ? 'PASS' : 'FAIL')}`).join('\n'), '',
    '## Heatmap persona x estágio', '', 'persona|stage|quality', personaHeatmap, '',
    '## Top-5 momentos de risco', risks, '',
    '## Play efetivo por persona/nível', plays, '',
    '## Diff vs rodada anterior', `- ${report.diff_previous_round.reason}`, '',
    'Métricas invisíveis por turno incluem latência p50/p95, LLM calls, tokens, custo, Judge/honesty blocks, memória, cadência, deduplicação, Scout, virada e quase-perda.', ''
  ].join('\n');
  fs.writeFileSync(path.join(directory, 'report.md'), markdown);
  const decision = [
    '# Relatório de decisão',
    '', '## Resumo executivo', `- Seed: ${report.seed}`, `- Gate geral: ${report.gate_pass ? 'PASS' : 'FAIL'}`,
    '', '## Gates F1-F8', `- Bandas: ${report.curriculum.every(x => x.passed) ? 'PASS' : 'FAIL'}`, `- F1 por nível: ${report.curriculum.map(x => `N${x.level} n=${x.sample_n}: ${x.sample_status === 'amostra insuficiente' ? 'amostra insuficiente' : (x.passed ? 'PASS' : 'FAIL')}`).join('; ')}`, `- Telemetria LLM: ${report.llm_telemetry.gate_pass ? 'PASS' : 'FAIL (indisponível)'}`, `- Telemetria: ${report.llm_telemetry.tokens || 0} tokens, ${report.llm_telemetry.calls || 0} llm_calls, custo R$ ${report.llm_telemetry.cost_r$ || 0}`, `- Scout desconhecidos: ${report.scout_unknowns}`,
    '', '## Pagamentos e reconciliação', `- Eventos pagos emitidos: ${report.paid_events.length}`, `- Reconciliação confirmada: ${report.paid_reconciliation ? 'sim' : 'não'}`,
    '', '## Bandit e lições', `- Recompensas no intervalo [0,1]: ${report.bandit.every(x => x.reward >= 0 && x.reward <= 1) ? 'sim' : 'não'}`, `- Lições de perdas: ${report.lessons.length}`,
    '', '## Sugestões regression-gated', `- Regression gate ativo: ${report.suggestions.regression_gated ? 'sim' : 'não'}`,
    '', '## Scout desconhecidos', `- Capturas: ${report.scout_unknowns}`,
    '', '## Top-3 lições de perda', report.top_risk_moments.slice(0, 3).map(item => `- ${item.persona} T${item.turn}: fala exata do Hunter indisponível no simulador determinístico; entrada observada: "${item.fala}"`).join('\n') || '- nenhuma',
    '', '## Matriz de plug', '- Consulte `docs/plug-audit.md`; agentes de produção resolvem Workers AI -> Pollinations e o laboratório usa a cadeia local documentada.',
    '', '## Limitações e evidências', report.llm_telemetry.unavailable ? '- Nenhuma chave real foi usada nesta geração; o relatório não fabrica telemetria.' : '- Telemetria proveniente do provider local selecionado.'
  ].join('\n');
  fs.writeFileSync(path.join(directory, 'report-decisao.md'), `${decision}\n`);
  return directory;
}

export function writePhaseJReports(report, previous = null, directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'simulator')) {
  fs.writeFileSync(path.join(directory, 'diagnostic-turns-20260910.json'), `${JSON.stringify(report.diagnostic_turns || [], null, 2)}\n`);
  const previousRates = Object.fromEntries((previous?.curriculum || []).map(level => [level.level, level.win_rate]));
  const currentRates = Object.fromEntries((report.curriculum || []).map(level => [level.level, level.win_rate]));
  const previousPlays = previous?.bandit_by_play || {};
  const currentPlays = report.bandit_by_play || {};
  const improvedLevels = Object.keys(currentRates).filter(level => Number(currentRates[level]) > Number(previousRates[level] ?? -1));
  const improvedPlays = Object.keys(currentPlays).filter(play => Number(currentPlays[play].reward_mean) > Number(previousPlays[play]?.reward_mean ?? -1));
  const diff = [
    '# Diff regression-gated — seed 20260910', '',
    '| Métrica | Antes | Depois | Resultado |', '|---|---:|---:|---|',
    ...Object.keys(currentRates).map(level => `| N${level} win rate | ${previousRates[level] ?? 'N/D'} | ${currentRates[level]} | ${currentRates[level] > (previousRates[level] ?? -1) ? 'melhorou' : 'não melhorou'} |`),
    '', `- Níveis com melhora: ${improvedLevels.length}`, `- Plays com reward médio melhor: ${improvedPlays.length}`,
    `- Quase-perdas atuais: ${(report.top_almost_losses || []).length}`,
    `- LastMileClose antes: ${previous?.last_mile?.activated ?? 'N/D'}; depois: ${report.last_mile?.activated ?? 0}`,
    '', `**Assert de melhora em 2 métricas:** ${improvedLevels.length + improvedPlays.length >= 2 ? 'PASS' : 'FAIL'}`,
    '- Nenhuma banda foi alterada.'
  ].join('\n');
  fs.writeFileSync(path.join(directory, 'diff-20260910.md'), `${diff}\n`);
  const bands = report.curriculum.filter(level => level.passed).length;
  const reconciliation = report.diagnostic_reconciliation || report.reconciliation || [];
  const paid = reconciliation.filter(item => item.paid_emitted);
  const reconciled = paid.filter(item => item.reconciled).length;
  const telemetryPass = Boolean(report.llm_telemetry?.calls > 0 && report.llm_telemetry?.tokens > 0 && !report.llm_telemetry?.unavailable);
  const decision = [
    '# Relatório de decisão — rodada regression-gated seed 20260910', '',
    '## Resumo executivo', `- Gate geral: **${report.gate_pass ? 'PASS' : 'FAIL'}**`, `- Bandas atendidas: ${bands}/10 níveis`, `- Reconciliação: ${reconciled}/${paid.length} conversões confirmadas`, `- Melhora vs rodada anterior: ${improvedLevels.length} níveis; ${improvedPlays.length} plays`,
    '', '## Semáforo', `- Conversão: ${report.win_rate > 0 ? '🟡' : '🔴'}`, `- Robustez: ${report.anti_cooperation?.never_buyer_wins === 0 ? '🟢' : '🔴'}`, `- Telemetria: ${telemetryPass ? '🟢' : '🔴'}`, `- Aprendizado: ${Object.keys(currentPlays).length ? '🟡' : '🔴'}`,
    '', '## Classificação por nível', '| Nível | Banda | n | Win rate | IC95 | Status |', '|---:|---|---:|---:|---|---|', ...report.curriculum.map(level => `| N${level.level} | ${level.band} | ${level.sample_n} | ${level.win_rate} | [${level.ci95?.low ?? 'N/D'}, ${level.ci95?.high ?? 'N/D'}] | ${level.passed ? 'PASS' : 'FAIL'} |`),
    '', '## Reconciliação por conversa', ...reconciliation.map(item => `- ${item.persona}: final=${item.final_stage}, paid_emitted=${item.paid_emitted}, confirm_simulated=${item.confirm_simulated}, reconciled=${item.reconciled}, win_counted=${item.win_counted}`),
    '', '## Heatmap persona × estágio final', ...(report.scenarios || []).map(scenario => `- ${scenario.persona_id}: ${scenario.final_node} (${scenario.turns.length} turnos)`),
    '', '## Top-10 quase-perdas com fala exata', ...(report.top_almost_losses || []).slice(0, 10).map((turn, index) => `${index + 1}. ${turn.persona}, turno ${turn.turn_number}: "${turn.hunter_reply}"; score ${turn.score_before} -> ${turn.score_after}; play ${turn.play_selected}`),
    '', '## Reward por play', ...Object.entries(currentPlays).map(([play, stats]) => `- ${play}: trials=${stats.trials}, reward_sum=${stats.reward_sum}, reward_mean=${stats.reward_mean}, std=${stats.reward_std}, IC95=${stats.ci95.low}-${stats.ci95.high}`),
    '', '## LastMileClose', `- Acionamentos: ${report.last_mile?.activated || 0}`, `- Conversões: ${report.last_mile?.converted || 0}`,
    '', '## Scout', `- Unknowns capturados: ${report.scout_unknowns}`, `- Sugestões geradas: ${report.scout_unknowns}; aprovadas: 0 (N/D no relatório-base)`,
    '', '## As 3 decisões para o fundador', '1. Iterar mais uma rodada com amostra e instrumentação; não alterar bandas.', '2. Não substituir play sem reward por play e IC95; manter a instrumentação.', '3. Usar a trilha explícita de reconciliação; não contar `final_stage=pago` sem confirmação simulada.',
    '', '## Evidência', `- Telemetria: ${report.llm_telemetry?.calls || 0} llm_calls, ${report.llm_telemetry?.tokens || 0} tokens, custo projetado R$ ${report.llm_telemetry?.cost_r$ || 0}`, '- Turnos completos: `simulator/diagnostic-turns-20260910.json`', '- Diff: `simulator/diff-20260910.md`', '- Nenhum segredo foi registrado; nenhum deploy foi executado.'
  ].join('\n');
  fs.writeFileSync(path.join(directory, 'report-decisao.md'), `${decision}\n`);
}

if (process.argv[1] && process.argv[1].endsWith('phase-e-simulator.js')) {
  const seedFlag = process.argv.find(arg => arg === '--seed' || arg.startsWith('--seed='));
  const seed = seedFlag?.startsWith('--seed=') ? seedFlag.slice(7) : (seedFlag ? process.argv[process.argv.indexOf('--seed') + 1] : 20260909);
  const valueFlag = name => {
    const inline = process.argv.find(arg => arg.startsWith(`${name}=`));
    if (inline) return inline.slice(name.length + 1);
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
  };
  const providerValue = valueFlag('--provider');
  const subsetValue = valueFlag('--personas-subset');
  const turnsValue = valueFlag('--max-turns');
  const providerFlag = providerValue !== undefined;
  const subsetFlag = subsetValue !== undefined;
  const turnsFlag = turnsValue !== undefined;
  const minRealCallsValue = valueFlag('--min-real-calls');
  const batchValue = valueFlag('--batch');
  const referenceFlag = process.argv.includes('--reference');
  const requireReal = process.argv.includes('--require-real');
const noCache = process.argv.includes('--no-cache');
  const labSecrets = loadLabSecrets();
  const realKeyNames = ['OPENROUTER_API_KEY', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'GITHUB_MODELS_TOKEN', 'GITHUB_TOKEN', 'CEREBRAS_API_KEY'];
  const minRealCalls = Number(minRealCallsValue || (requireReal ? 20 : 0));
  if (requireReal && !realKeyNames.some(name => Boolean(labSecrets[name]))) {
    console.error('FAIL: --require-real exige uma credencial de provider real.');
    process.exitCode = 1;
  } else if (providerFlag || subsetFlag || turnsFlag || requireReal) {
    const provider = providerFlag ? providerValue : (requireReal ? 'auto' : 'mock');
    const allPersonas = loadPersonas();
    const batchSize = batchValue ? Math.max(1, Number(batchValue)) : 0;
    const statePath = path.resolve('simulator', 'batch-state.json');
    let batchState = { seed: Number(seed), personas_completed: 0, turns_by_persona: {} };
    if (batchSize && fs.existsSync(statePath)) {
      try { batchState = JSON.parse(fs.readFileSync(statePath, 'utf8')); } catch (_) { }
    }
    const targetPersonas = subsetFlag ? Number(subsetValue) : (requireReal ? 10 : 20);
    const batchStart = batchSize ? Number(batchState.personas_completed || 0) : 0;
    const personasSubset = batchSize ? Math.min(batchSize, targetPersonas - batchStart) : (subsetFlag ? Number(subsetValue) : 6);
    if (batchSize && personasSubset <= 0) { console.error('FAIL: batch-state já contém a amostra completa.'); process.exitCode = 1; }
    const maxTurns = turnsFlag ? Number(turnsValue) : 5;
    const retryDelaysMs = process.env.CHATPAY_RETRY_DELAYS_MS ? process.env.CHATPAY_RETRY_DELAYS_MS.split(',').map(Number).filter(Number.isFinite) : undefined;
    const runEvents = [];
    const logEvent = event => {
      const safe = { ts: new Date().toISOString(), ...event };
      runEvents.push(safe);
      if (event.type === 'retry') console.log(`[retry] provider=${event.provider} status=${event.status} backoff=${event.backoff_s}s`);
      if (event.type === 'call') console.log(`[turno ${event.turn} | persona ${event.persona}] provider=${event.provider} status=${event.status} ms=${event.ms} tokens=${event.tokens}${event.cache_hit ? ' cache=hit' : ''}`);
      if (event.type === 'probe') console.log(`probe ${event.provider}=${event.status}`);
    };
    const probes = await probeProviders({ env: labSecrets, onEvent: logEvent });
    console.log(`probe table: ${REAL_PROVIDERS.map(name => `${name}=${probes[name] ?? 'ausente'}`).join(' ')}`);
    const providerOrder = sortProviderOrderByProbe(probes, REAL_PROVIDERS);
    const requestedProvider = provider === 'github' ? 'github_models' : provider;
    const selectedPersonas = batchSize ? allPersonas.slice(batchStart, batchStart + personasSubset) : allPersonas;
    let existingRunLog = [];
    try { existingRunLog = JSON.parse(fs.readFileSync(RUN_LOG, 'utf8')); if (!Array.isArray(existingRunLog)) existingRunLog = []; } catch (_) { }
    let report;
    try {
      report = await runProviderSimulation({ personas: selectedPersonas, provider: requestedProvider, seed: Number(seed) + batchStart, personasSubset, maxTurns, cacheFile: requireReal ? REAL_CACHE : undefined, useCache: !noCache, requireReal, retryDelaysMs, onEvent: logEvent, providerOrder, forceProvider: providerFlag });
    } catch (error) {
      fs.writeFileSync(RUN_LOG, `${JSON.stringify([...existingRunLog, { ts: new Date().toISOString(), seed: Number(seed), provider: requestedProvider, status: 'failed', error: error.message, events: runEvents }], null, 2)}\n`);
      throw error;
    }
    fs.writeFileSync(RUN_LOG, `${JSON.stringify([...existingRunLog, { ts: new Date().toISOString(), seed: Number(seed), provider: requestedProvider, status: 'completed', events: runEvents }], null, 2)}\n`);
    const realProviderCalls = REAL_PROVIDERS.reduce((total, name) => total + Number(report.llm_telemetry?.providers?.[name] || 0), 0);
    const providerReplies = new Map(report.scenarios.map(scenario => [scenario.persona_id, scenario.turns.map(turn => turn.reply)]));
    const replyFor = ({ persona, index, text, intent }) => providerReplies.get(persona.id)?.[index] || `Resposta determinística para ${intent}: ${text}`;
    const previousReport = fs.existsSync(path.resolve('simulator', 'report.json')) ? JSON.parse(fs.readFileSync(path.resolve('simulator', 'report.json'), 'utf8')) : null;
    const priorScenarios = Object.entries(batchState.turns_by_persona || {}).map(([persona_id, turns]) => ({ persona_id, turns }));
    const allScenarios = batchSize ? [...priorScenarios, ...report.scenarios] : report.scenarios;
    const phasePersonas = batchSize ? allPersonas.slice(0, allScenarios.length) : allPersonas.slice(0, personasSubset);
    if (batchSize) {
      const turnsByPersona = Object.fromEntries(allScenarios.map(scenario => [scenario.persona_id, scenario.turns]));
      fs.writeFileSync(statePath, `${JSON.stringify({ seed: Number(seed), personas_completed: allScenarios.length, turns_by_persona: turnsByPersona }, null, 2)}\n`);
    }
    const phaseReport = runPhaseESimulator({
      seed,
      personas: phasePersonas,
      maxTurns,
      replyFor: ({ persona, index, text, intent }) => allScenarios.find(scenario => scenario.persona_id === persona.id)?.turns?.[index]?.reply || replyFor({ persona, index, text, intent }),
      telemetry: {
        ...report.llm_telemetry,
        real_provider_calls: realProviderCalls,
        unavailable: realProviderCalls === 0,
        gate_pass: realProviderCalls >= minRealCalls && Number(report.llm_telemetry?.tokens || 0) > 0 && !report.round_failed,
        min_real_calls: minRealCalls,
        failure_rate: report.failure_rate || 0,
        failed_turns: report.failed_turns || 0,
        total_turns: report.total_turns || 0,
        round_failed: report.round_failed || false,
        source: 'scripts/phase-e-simulator.js --require-real'
      }
    });
    const batchComplete = !batchSize || allScenarios.length >= targetPersonas;
    if (batchComplete) {
      writePhaseEReports(phaseReport);
      writePhaseJReports(phaseReport, previousReport);
    }
    if (requireReal && realProviderCalls < minRealCalls) {
      console.error(`FAIL: ${realProviderCalls} chamadas reais novas; mínimo exigido: ${minRealCalls}.`);
      process.exitCode = 1;
    }
    if (report.round_failed) {
      console.error(`FAIL: rodada marcada como failed (${report.failed_turns}/${report.total_turns} turnos falharam, taxa=${(report.failure_rate * 100).toFixed(1)}%).`);
      process.exitCode = 1;
    }
    if (batchSize && !batchComplete) console.error(`BATCH INCOMPLETO: ${allScenarios.length}/${targetPersonas}; relatório final ainda não é evidência completa.`);
    const hasKey = Boolean(labSecrets.OPENROUTER_API_KEY);
    if (hasKey && provider === 'openrouter') fs.writeFileSync(path.resolve('simulator', 'reference-report.json'), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ ...report, reference_report: hasKey && provider === 'openrouter' ? 'simulator/reference-report.json' : 'unavailable (OPENROUTER_API_KEY ausente)' }, null, 2));
  } else {
    const report = runPhaseESimulator({ seed, personas: referenceFlag ? loadPersonas().slice(0, 4) : loadPersonas() });
    writePhaseEReports(report);
    console.log(JSON.stringify({ phase: report.phase, seed: report.seed, win_rate: report.win_rate, gate_pass: report.gate_pass }, null, 2));
  }
}
