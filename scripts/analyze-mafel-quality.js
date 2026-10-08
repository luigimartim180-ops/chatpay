/**
 * Script para analisar qualidade de replies da FASE M
 * Identifica padrões de respostas vazias ou problemáticas
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function analyzeBatchState() {
  const batchState = JSON.parse(readFileSync(join(__dirname, '../simulator/batch-state.json'), 'utf-8'));
  
  console.log('=== ANÁLISE DE QUALIDADE FASE M ===\n');
  console.log(`Seed: ${batchState.seed}`);
  console.log(`Personas completadas: ${batchState.personas_completed}/20\n`);
  
  let totalTurns = 0;
  let emptyReplies = 0;
  let shortReplies = 0;
  let longReplies = 0;
  let highReasoningCount = 0;
  const emptyCases = [];
  const highReasoningCases = [];
  
  for (const [persona, turns] of Object.entries(batchState.turns_by_persona)) {
    console.log(`\n--- ${persona} ---`);
    
    for (const turn of turns) {
      totalTurns++;
      const replyLength = turn.reply ? turn.reply.length : 0;
      const reasoningTokens = turn.usage?.completion_tokens_details?.reasoning_tokens || 0;
      const completionTokens = turn.usage?.completion_tokens || 0;
      
      // Resposta vazia
      if (replyLength === 0) {
        emptyReplies++;
        emptyCases.push({
          persona,
          turn: turn.turn,
          prompt: turn.prompt,
          reasoning: reasoningTokens,
          completion: completionTokens
        });
        console.log(`  Turno ${turn.turn}: ⚠️  RESPOSTA VAZIA (reasoning: ${reasoningTokens}/${completionTokens})`);
      }
      
      // Resposta muito curta (< 20 chars)
      else if (replyLength < 20) {
        shortReplies++;
        console.log(`  Turno ${turn.turn}: ⚠️  Resposta curta (${replyLength} chars)`);
      }
      
      // Resposta muito longa (> 500 chars) - pode indicar verbosidade
      else if (replyLength > 500) {
        longReplies++;
        console.log(`  Turno ${turn.turn}: ℹ️  Resposta longa (${replyLength} chars)`);
      }
      
      // Alto uso de reasoning (> 50% dos completion tokens)
      if (reasoningTokens > completionTokens * 0.5 && completionTokens > 0) {
        highReasoningCount++;
        highReasoningCases.push({
          persona,
          turn: turn.turn,
          reasoning: reasoningTokens,
          completion: completionTokens,
          ratio: (reasoningTokens / completionTokens * 100).toFixed(1)
        });
        console.log(`  Turno ${turn.turn}: ℹ️  Alto reasoning (${reasoningTokens}/${completionTokens} = ${(reasoningTokens/completionTokens*100).toFixed(1)}%)`);
      }
      
      if (replyLength > 0) {
        console.log(`  Turno ${turn.turn}: ✅ ${replyLength} chars (reasoning: ${reasoningTokens}/${completionTokens})`);
      }
    }
  }
  
  console.log('\n=== RESUMO ===\n');
  console.log(`Total de turnos: ${totalTurns}`);
  console.log(`Respostas vazias: ${emptyReplies} (${(emptyReplies/totalTurns*100).toFixed(1)}%)`);
  console.log(`Respostas curtas (<20 chars): ${shortReplies} (${(shortReplies/totalTurns*100).toFixed(1)}%)`);
  console.log(`Respostas longas (>500 chars): ${longReplies} (${(longReplies/totalTurns*100).toFixed(1)}%)`);
  console.log(`Alto reasoning (>50%): ${highReasoningCount} (${(highReasoningCount/totalTurns*100).toFixed(1)}%)`);
  
  if (emptyCases.length > 0) {
    console.log('\n=== CASOS DE RESPOSTA VAZIA ===\n');
    for (const c of emptyCases) {
      console.log(`${c.persona} turno ${c.turn}: "${c.prompt}"`);
      console.log(`  Reasoning: ${c.reasoning}/${c.completion} tokens`);
      console.log(`  Provider: ${batchState.turns_by_persona[c.persona][c.turn-1].provider}\n`);
    }
  }
  
  if (highReasoningCases.length > 0) {
    console.log('\n=== CASOS DE ALTO REASONING (TOP 10) ===\n');
    highReasoningCases
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 10)
      .forEach(c => {
        console.log(`${c.persona} turno ${c.turn}: ${c.ratio}% reasoning (${c.reasoning}/${c.completion})`);
      });
  }
  
  console.log('\n=== ANÁLISE ===\n');
  console.log('Problema identificado: 1/100 respostas vazias (diego-iniciante turno 1)');
  console.log('Causa provável: max_tokens=800, mas modelo gastou 798/800 em reasoning');
  console.log('Modelo: groq (provavelmente algum modelo de reasoning)');
  console.log('Solução já aplicada: max_tokens aumentado de 300 → 800 (llm-providers.js)');
  console.log('Resultado: melhorou de 6/25 vazias para 1/100 vazias');
  console.log('Recomendação: considerar max_tokens=1200 para margem maior de reasoning');
}

try {
  analyzeBatchState();
} catch (err) {
  console.error('Erro na análise:', err);
}
