import { createProviderChain, generateWithProviders } from './scripts/llm-providers.js';

const chain = createProviderChain();

// Teste REAL: Function calling com Groq
async function runTest() {
  console.log('=== TESTE REAL COM CHAVE GROQ ===');
  console.log('');
  
  const r = await generateWithProviders(
    'Calculate 20% discount on R$ 500.00. Return ONLY this JSON format: {"final_price": VALUE, "savings": VALUE, "installments": "3x de VALUE"}. No text before or after.',
    { 
      seed: 20260920, 
      persona: 'comprador interessado', 
      turn: 1, 
      provider: 'groq', 
      chain 
    }
  );
  
  console.log('Provider:', r.provider);
  console.log('Response:', r.reply);
  console.log('Tokens:', r.usage?.total_tokens);
  console.log('');
  
  // Validar se é JSON de verdade
  try {
    const parsed = JSON.parse(r.reply);
    console.log('✅ JSON VÁLIDO!');
    console.log('   final_price:', parsed.final_price);
    console.log('   savings:', parsed.savings);
    console.log('   installments:', parsed.installments);
  } catch (e) {
    console.log('❌ JSON inválido:', e.message);
  }
}

runTest().catch(e => console.error('❌ Erro:', e.message));