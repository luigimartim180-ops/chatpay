// TESTE REAL COMPLETO: Groq API + worker.js integration + tools
import { createProviderChain, generateWithProviders } from './scripts/llm-providers.js';
import fs from 'fs';
import { requireExternalTestOptIn } from './scripts/test-opt-in.mjs';

requireExternalTestOptIn('provider');
const chain = createProviderChain();
const workerCode = fs.readFileSync('worker.js', 'utf8');

console.log('='.repeat(70));
console.log('TESTE REAL COMPLETO: Groq API + worker.js Integration');
console.log('='.repeat(70));
console.log();

// Test 1: JSON structurado (já testado, confirmar)
console.log('🔸 TEST 1: JSON Estruturado com Groq');
console.log('-'.repeat(70));
const r1 = await generateWithProviders(
  'Return JSON only: {"final_price": VALUE, "savings": VALUE, "installments": "3x de VALUE"}. No text.',
  { seed: 20260923, persona: '', turn: 0, provider: 'groq', chain }
);
console.log('Response:', r1.reply);
try {
  const p = JSON.parse(r1.reply);
  console.log('✅ JSON válido - final_price:', p.final_price, ', savings:', p.savings);
} catch (e) {
  console.log('❌ JSON inválido');
}
console.log();

// Test 2: Simular o fluxo do worker.js com tools
console.log('🔸 TEST 2: Simular fluxo worker.js com tools whitelist');
console.log('-'.repeat(70));

// Simular o que acontece quando o LLM retorna tool call no worker
const mockLlmResponse = '{"tool":"calcular_parcelamento","args":{"valor": 500, "parcelas": 12}}';

// Este é o código real do worker.js lines 782-787
let toolResult = null;
if (mockLlmResponse.startsWith('{') && mockLlmResponse.includes('"tool"')) {
  try {
    const toolCall = JSON.parse(mockLlmResponse.match(/\\{[\s\\S]*\\}/)?.[0] || '{}');
    if (toolCall.tool) {
      toolResult = { success: true, installment_text: `12x de R$ ${(500 / 12).toFixed(2)}`, parcelas: 12 };
      console.log('✅ tool_call parsed:', toolCall.tool);
      console.log('✅ Result:', JSON.stringify(toolResult));
    }
  } catch (e) {
    console.log('❌ Parse error:', e.message);
  }
}

// Se tiver resultado, gerar resposta final
if (toolResult) {
  const followPrompt = `A ferramenta respondeu: ${JSON.stringify(toolResult)}. Agora elabore a resposta final para o cliente em PT-BR (<= 280 caracteres) incluindo link: https://midas-core.novoronaldo-m.workers.dev/pay?d=teste`;
  
  const rFinal = await generateWithProviders(
    followPrompt,
    { seed: 20260924, persona: '', turn: 0, provider: 'groq', chain }
  );
  console.log('✅ Response final:', rFinal.reply.substring(0, 100) + (rFinal.reply.length > 100 ? '...' : ''));
  console.log('🔢 Tokens:', rFinal.usage?.total_tokens);
}
console.log();

// Test 3: Verificar integração no worker.js (code checks)
console.log('🔸 TEST 3: Verificar código do worker.js pronto para integração real');
console.log('-'.repeat(70));

const checks = [
  ['function_call parameter', workerCode.includes('function_call')],
  ['tool_calls OpenAI format', workerCode.includes('msg.tool_calls')],
  ['tool_choice Anthropic format', workerCode.includes('body.tool_choice')],
  ['let toolResult variable', workerCode.includes('let toolResult')],
  ['replyRaw.type check', workerCode.includes('replyRaw.type === "tool"')],
  ['executeTool call', workerCode.includes('await executeTool(dom')],
  ['pipeline runAgentPipeline', workerCode.includes('async function runAgentPipeline(')]
];

let passed = 0;
checks.forEach(([name, result]) => {
  const status = result ? '✅' : '❌';
  console.log(status, ' ', name);
  if (result) passed++;
});
console.log('Total:', passed, '/', checks.length);

// Test 4: Verificar se executeTool estaria pronto para Redis/Playbook real
console.log();
console.log('🔸 TEST 4: Estrutura executeTool() no worker.js');
console.log('-'.repeat(70));
const executeToolMatch = workerCode.match(/async function executeTool\(dom, toolName, args, pb\)/);
if (executeToolMatch) {
  console.log('✅ executeTool() assinatura encontrada no worker.js');
  // Mostrar os primeiros linhas da função
  const executeToolStart = workerCode.indexOf('async function executeTool');
  const executeToolSection = workerCode.substring(executeToolStart, executeToolStart + 200);
  console.log('   Corpo:', executeToolSection.substring(0, 150) + '...');
}