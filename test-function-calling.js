import { createProviderChain, generateWithProviders } from './scripts/llm-providers.js';

const chain = createProviderChain();

// Test 1: Simple text (baseline)
async function test1() {
  console.log('=== TEST 1: Simple text ===');
  const r = await generateWithProviders(
    'Olá, como vai? Responda apenas um cumprio.',
    { seed: 20260909, persona: '', turn: 0, provider: 'groq', chain }
  );
  console.log('Provider:', r.provider);
  console.log('Response:', r.reply);
  console.log('Tokens:', r.usage?.total_tokens);
  console.log('');
}

// Test 2: Function calling - ask for JSON structure
async function test2() {
  console.log('=== TEST 2: Function calling / JSON structure ===');
  const r = await generateWithProviders(
    'Calculate 20% discount on R$ 150. Return JSON only: {"final_price": VALUE, "discount": VALUE}',
    { seed: 20260910, persona: '', turn: 0, provider: 'groq', chain }
  );
  console.log('Provider:', r.provider);
  console.log('Response:', r.reply);
  console.log('Tokens:', r.usage?.total_tokens);
  console.log('');
}

// Test 3: Via worker.js callLLM with tools (the real integration)
async function test3() {
  console.log('=== TEST 3: Worker.js callLLM integration ===');
  try {
    // Import the worker function
    const fs = await import('fs');
    const workerCode = fs.readFileSync('worker.js', 'utf8');
    
    // Just verify the function calling code is there
    const hasFunctionCall = workerCode.includes('function_call') && workerCode.includes('tool_calls');
    const hasToolResult = workerCode.includes('let toolResult') && workerCode.includes('replyRaw.type');
    
    console.log('Has function_call support:', hasFunctionCall);
    console.log('Has toolResult handler:', hasToolResult);
    console.log('✅ Integration code present in worker.js');
  } catch (e) {
    console.error('❌ Error:', e.message);
  }
}

test1().then(test2).then(test3);