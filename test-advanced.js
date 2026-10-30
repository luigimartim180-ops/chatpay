// ADVANCED COMPLEX TEST SUITE FOR CHATPAY FUNCTION CALLING INTEGRATION

import { createProviderChain, generateWithProviders } from './scripts/llm-providers.js';
import fs from 'fs';
import { requireExternalTestOptIn } from './scripts/test-opt-in.mjs';

requireExternalTestOptIn('provider');
const chain = createProviderChain();

console.log('='.repeat(60));
console.log('CHATPAY ADVANCED FUNCTION CALLING TEST SUITE');
console.log('='.repeat(60));
console.log();

// Test 1: Simple text generation (baseline)
async function testSimpleText() {
  console.log('🔸 TEST 1: Simple text generation (baseline)');
  console.log('-'.repeat(60));
  const start = Date.now();
  const r = await generateWithProviders(
    'Seja bem-vindo! Apresente nossos serviços de automação comercial em no máximo 3 linhas, tom profissional.',
    { seed: 20260909, persona: '', turn: 0, provider: 'groq', chain }
  );
  const duration = Date.now() - start;
  console.log('✅ Provider:', r.provider);
  console.log('✅ Response time:', duration, 'ms');
  console.log('✅ Response:', r.reply);
  console.log('✅ Tokens used:', r.usage?.total_tokens || 'N/A');
  console.log('✅ Cache hit:', r.cache_hit ? 'Sim' : 'Não');
  console.log();
}

// Test 2: Function calling with JSON structure
async function testFunctionCallingJSON() {
  console.log('🔸 TEST 2: Function calling - JSON structure generation');
  console.log('-'.repeat(60));
  const start = Date.now();
  const r = await generateWithProviders(
    'Calculate 15% discount on R$ 297.00. Return ONLY JSON format: {"final_price": VALUE, "installments": "3x de VALUE", "savings": VALUE}. No text before or after JSON.',
    { seed: 20260910, persona: '', turn: 0, provider: 'groq', chain }
  );
  const duration = Date.now() - start;
  console.log('✅ Provider:', r.provider);
  console.log('✅ Response time:', duration, 'ms');
  console.log('✅ Response:', r.reply);
  console.log('✅ Tokens used:', r.usage?.total_tokens || 'N/A');
  
  // Validate JSON
  try {
    const parsed = JSON.parse(r.reply);
    console.log('✅ JSON valid!');
    console.log('✅ final_price:', parsed.final_price);
    console.log('✅ installments:', parsed.installments);
    console.log('✅ savings:', parsed.savings);
  } catch (e) {
    console.log('❌ JSON invalid:', e.message);
  }
  console.log();
}

// Test 3: Worker.js callLLM integration points
async function testWorkerIntegration() {
  console.log('🔸 TEST 3: Worker.js callLLM integration points');
  console.log('-'.repeat(60));
  
  const workerCode = fs.readFileSync('worker.js', 'utf8');
  const checks = [
    ['function_call parameter', workerCode.includes('function_call')],
    ['tool_calls OpenAI format', workerCode.includes('msg.tool_calls')],
    ['tool_choice Anthropic format', workerCode.includes('body.tool_choice')],
    ['let toolResult variable', workerCode.includes('let toolResult')],
    ['replyRaw.type check', workerCode.includes('replyRaw.type === "tool"')],
    ['executeTool call', workerCode.includes('await executeTool(dom')],
    ['pipeline agent execution', workerCode.includes('async function runAgentPipeline(')]
  ];
  
  let passed = 0;
  checks.forEach(([name, result]) => {
    const status = result ? '✅' : '❌';
    console.log(status, ' ', name);
    if (result) passed++;
  });
  console.log('Total:', passed, '/', checks.length, 'checks passed');
  console.log();
}

// Test 4: Full end-to-end simulation (mock)
async function testEndToEndSimulation() {
  console.log('🔸 TEST 4: End-to-end simulation with tools and agents');
  console.log('-'.repeat(60));
  
  const prompt = 'Playbook ativo: nicho=educacao, tom=claro.\n\nLead: "Acho o preco um pouco alto para mim."\nIntent: objection\nAvailable tools: consultar_estoque (endpoint: https://api.loja.com/estoque)\n\nGenerate a response that may use the tool to check stock, then handle the objection about price.\nKeep under 280 characters. Include payment link placeholder: https://pay.link exemplo';
  
  const r = await generateWithProviders(
    prompt,
    { 
      seed: 20260911, 
      persona: '', 
      turn: 0, 
      provider: 'groq', 
      chain,
      function_call: 'auto'
    }
  );
  
  console.log('✅ Provider:', r.provider);
  console.log('✅ Response type:', r.type || 'text');
  console.log('✅ Response length:', r.reply?.length || 0, 'chars');
  console.log('✅ Response preview:', r.reply?.substring(0, 150) + (r.reply?.length > 150 ? '...' : ''));
  console.log('✅ Tokens:', r.usage?.total_tokens || 'N/A');
  console.log();
}

// Run all tests
async function runAllTests() {
  await testSimpleText();
  await testFunctionCallingJSON();
  await testWorkerIntegration();
  await testEndToEndSimulation();
  
  console.log('='.repeat(60));
  console.log('✅ ALL TESTS COMPLETED');
  console.log('='.repeat(60));
}

runAllTests().catch(e => {
  console.error('❌ Test suite error:', e.message);
  process.exit(1);
});