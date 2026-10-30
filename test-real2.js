import { createProviderChain, generateWithProviders } from './scripts/llm-providers.js';
import { requireExternalTestOptIn } from './scripts/test-opt-in.mjs';

requireExternalTestOptIn('provider');
const chain = createProviderChain();

async function runTest() {
  console.log('=== TESTE REAL SIMPLES COM GROQ ===');
  console.log('');
  
  // Testes mais simples primeiro
  const r1 = await generateWithProviders(
    'Olá, como vai?',
    { seed: 20260920, persona: '', turn: 0, provider: 'groq', chain }
  );
  console.log('Teste 1 - Texto simples:');
  console.log('  Provider:', r1.provider);
  console.log('  Response:', r1.reply);
  console.log('  Tokens:', r1.usage?.total_tokens);
  console.log('');
  
  const r2 = await generateWithProviders(
    'Calculate 20% off R$ 500. Return: final_price and savings.',
    { seed: 20260921, persona: '', turn: 0, provider: 'groq', chain }
  );
  console.log('Teste 2 - Estrutura simples:');
  console.log('  Provider:', r2.provider);
  console.log('  Response:', r2.reply);
  console.log('  Tokens:', r2.usage?.total_tokens);
  console.log('');
  
  // Test with function_call prompt
  const r3 = await generateWithProviders(
    'Return JSON only: {"price": 100, "discount": 20}. No other text.',
    { seed: 20260922, persona: '', turn: 0, provider: 'groq', chain }
  );
  console.log('Teste 3 - JSON puro:');
  console.log('  Provider:', r3.provider);
  console.log('  Response:', r3.reply);
  console.log('  Tokens:', r3.usage?.total_tokens);
}

runTest().catch(e => console.error('❌ Erro:', e.message));