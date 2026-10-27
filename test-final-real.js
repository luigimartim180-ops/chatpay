import { createProviderChain, generateWithProviders } from './scripts/llm-providers.js';
import fs from 'fs';

const chain = createProviderChain();
const workerCode = fs.readFileSync('worker.js', 'utf8');

console.log('='.repeat(70));
console.log('TESTE FINAL REAL: Groq + worker.js Integration');
console.log('='.repeat(70));
console.log();

// TEST 1: JSON estruturado
console.log('🔸 TEST 1: Function Calling - JSON Estruturado');
console.log('-'.repeat(70));
const r1 = await generateWithProviders(
  'Calculate 25% discount on R$ 400. Return ONLY: {"final_price": VALUE, "savings": VALUE, "installments": "4x de VALUE"}. Sem texto adicional.',
  { seed: 20260930, persona: 'cliente', turn: 1, provider: 'groq', chain }
);
console.log('Response:', r1.reply);
try {
  const p = JSON.parse(r1.reply);
  console.log('✅ JSON VÁLIDO!');
  console.log('   final_price:', p.final_price, '(25% off 400 =', 400*0.75, ')');
  console.log('   savings:', p.savings, '(25% =', 400*0.25, ')');
  console.log('   installments:', p.installments);
} catch(e) {
  console.log('❌ JSON inválido:', e.message);
}
console.log();

// TEST 2: Texto de venda real
console.log('🔸 TEST 2: Texto de Venda Real');
console.log('-'.repeat(70));
const r2 = await generateWithProviders(
  'Apresente nossos serviços de automação comercial para fechar venda. Tom: claro, profissional. Máximo 3 linhas. Inclua vantagens: automação, redução de custos, crescimento sustentável. Link: https://exemplo.com/pagar',
  { seed: 20260931, persona: 'donos de negocio', turn: 1, provider: 'groq', chain }
);
console.log('Response:', r2.reply);
console.log('Tokens:', r2.usage?.total_tokens);
console.log();

// TEST 3: worker.js integration checks
console.log('🔸 TEST 3: worker.js Integration Checks');
console.log('-'.repeat(70));
const checks = [
  ['function_call', workerCode.includes('function_call')],
  ['executeTool', workerCode.includes('async function executeTool')],
  ['runAgentPipeline', workerCode.includes('async function runAgentPipeline')],
  ['objectionHandler', workerCode.includes('async function objectionHandler')],
  ['proofGenerator', workerCode.includes('async function proofGenerator')],
];
let passados = 0;
checks.forEach(([nome, result]) => {
  console.log((result ? '✅' : '❌'), ' ', nome);
  if (result) passados++;
});
console.log('Total:', passados, '/', checks.length);
console.log();

// TEST 4: Status das chaves
console.log('🔸 STATUS DAS CHAVES');
console.log('-'.repeat(70));
console.log('GROQ_API_KEY:', process.env.GROQ_API_KEY ? 'CONFIGURADA (' + process.env.GROQ_API_KEY.substring(0, 10) + '...)' : 'NÃO CONFIGURADA');
console.log('GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? 'CONFIGURADA (' + process.env.GEMINI_API_KEY.substring(0, 10) + '...)' : 'NÃO CONFIGURADA');
console.log('REDIS_URL no Wrangler:', 'https://current-pheasant-114427.upstash.io (confirmado pelo usuario)');