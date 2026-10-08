// Teste simples para o endpoint /api/recover
// Testa: email inválido, email não encontrado, email encontrado

const BASE = 'https://midas-core.novoronaldo-m.workers.dev';

async function testRecover() {
  console.log('=== Teste /api/recover ===\n');

  // Test 1: Email inválido
  console.log('Test 1: Email inválido');
  try {
    const r = await fetch(`${BASE}/api/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'invalid-email' })
    });
    const d = await r.json();
    console.log(`  Status: ${r.status}`);
    console.log(`  Response: ${JSON.stringify(d)}`);
    console.log(`  Esperado: 400 com error='email inválido'`);
    console.log(r.status === 400 && d.error === 'email inválido' ? '  ✅ PASS' : '  ❌ FAIL');
  } catch (e) {
    console.log(`  ❌ ERROR: ${e.message}`);
  }

  console.log();

  // Test 2: Email não encontrado (404)
  console.log('Test 2: Email não encontrado');
  try {
    const r = await fetch(`${BASE}/api/recover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@example.com' })
    });
    const d = await r.json();
    console.log(`  Status: ${r.status}`);
    console.log(`  Response: ${JSON.stringify(d)}`);
    console.log(`  Esperado: 404 com message genérico`);
    console.log(r.status === 404 && d.message ? '  ✅ PASS' : '  ❌ FAIL');
  } catch (e) {
    console.log(`  ❌ ERROR: ${e.message}`);
  }

  console.log();

  // Test 3: Email encontrado (simulado - não podemos testar sem email real)
  console.log('Test 3: Email encontrado (requer email real cadastrado)');
  console.log('  ⚠️ SKIP: requer email válido no sistema');
  console.log('  Para testar manualmente: use email cadastrado em /start');

  console.log('\n=== Fim dos testes ===');
}

testRecover();
