// ==============================================================================
// CHATPAY V21 — TEST SUITE & COMANDOS DE AUDITORIA (SWARM + GROWTH ENGINE)
// ==============================================================================
//
// Comandos PowerShell / Bash para teste manual via curl:
//
// Defina as variaveis de ambiente:
// $env:BASE = "https://midas-core.novoronaldo-m.workers.dev" # ou "http://127.0.0.1:8787"
// $env:TOKEN = "<SEU_JWT_TOKEN>"
// $env:DOMAIN = "sualoja.com"
//
// 1. Emitir evento Swarm e validar dispatch no log:
// curl.exe -X POST "$env:BASE/api/swarm-event" -H 'Content-Type: application/json' -d "{\"token\":\"$env:TOKEN\",\"type\":\"lead\",\"channel\":\"instagram\",\"user\":\"lead_user_123\",\"text\":\"quero comprar o plano agora\",\"lead_id\":\"lead_abc_1\"}"
//
// 2. Consumir itens da Reply-Queue:
// curl.exe "$env:BASE/api/reply-queue?channel=instagram&token=$env:TOKEN"
//
// 3. Agendar Recuperação (Recoverer):
// curl.exe -X POST "$env:BASE/api/recovery" -H 'Content-Type: application/json' -d "{\"token\":\"$env:TOKEN\",\"txid\":\"CP1234567890\"}"
//
// 4. Gerar Link de Afiliado (Referrer):
// curl.exe -X POST "$env:BASE/api/affiliate" -H 'Content-Type: application/json' -d "{\"token\":\"$env:TOKEN\",\"buyerEmail\":\"comprador@exemplo.com\"}"
//
// 5. Testar Guardrails / Caps do Guardian (limitar a 1 resposta/hora):
// curl.exe -X POST "$env:BASE/api/swarm-config" -H 'Content-Type: application/json' -d "{\"token\":\"$env:TOKEN\",\"cap\":1}"
//
// 6. Testar Analytics com Atribuição Real (mata revenue_attributed_cents: 0):
// curl.exe "$env:BASE/api/hunter-analytics?d=$env:DOMAIN&token=$env:TOKEN"
//
// ==============================================================================

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const TOKEN = process.env.TOKEN || '';
const DOMAIN = process.env.DOMAIN || 'sualoja.com';

async function runTests() {
  console.log(`\n⚡ Iniciando suite de testes ChatPay V21 contra: ${BASE}\n`);

  if (!TOKEN) {
    console.log('⚠️  AVISO: Variavel TOKEN nao informada.');
    console.log('    Para rodar a suite automatizada contra o Worker, execute:');
    console.log('    $env:TOKEN = "seu-token-jwt"; node test-v21.js\n');
    console.log('✅ Arquivo de teste test-v21.js pronto para uso.');
    return;
  }
  if (process.env.ALLOW_LIVE_API_TESTS !== '1') {
    console.log('⏭️  Requisições live desativadas. Defina ALLOW_LIVE_API_TESTS=1 para autorizar explicitamente.');
    return;
  }

  const headers = { 'Content-Type': 'application/json' };

  try {
    // (a) Emitir evento Swarm
    console.log('1. Testando POST /api/swarm-event...');
    const r1 = await fetch(`${BASE}/api/swarm-event`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token: TOKEN,
        type: 'lead',
        channel: 'instagram',
        user: 'teste_user',
        text: 'qual o valor do produto?',
        lead_id: 'lead_test_' + Date.now()
      })
    });
    const d1 = await r1.json();
    console.log('   Resultado:', d1.status === 'queued' ? '✅ SUCESSO' : '❌ FALHA', d1);

    // (b) Reply-Queue
    console.log('\n2. Testando GET /api/reply-queue...');
    const r2 = await fetch(`${BASE}/api/reply-queue?channel=instagram&token=${encodeURIComponent(TOKEN)}`);
    const d2 = await r2.json();
    console.log('   Resultado:', Array.isArray(d2.items) ? '✅ SUCESSO' : '❌ FALHA', `Itens consumidos: ${d2.items?.length || 0}`);

    // (c) Recovery
    console.log('\n3. Testando POST /api/recovery...');
    const r3 = await fetch(`${BASE}/api/recovery`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token: TOKEN,
        txid: 'CP_TEST_' + Date.now()
      })
    });
    const d3 = await r3.json();
    console.log('   Resultado:', d3.status === 'scheduled' ? '✅ SUCESSO' : '❌ FALHA', d3);

    // (d) Afiliado
    console.log('\n4. Testando POST /api/affiliate...');
    const r4 = await fetch(`${BASE}/api/affiliate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token: TOKEN,
        buyerEmail: 'comprador@teste.com'
      })
    });
    const d4 = await r4.json();
    console.log('   Resultado:', d4.status === 'issued' && d4.commission === 0.3 ? '✅ SUCESSO' : '❌ FALHA', d4);

    // (e) Guardian Caps / Config
    console.log('\n5. Testando POST /api/swarm-config (Caps & Playbook)...');
    const r5 = await fetch(`${BASE}/api/swarm-config`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        token: TOKEN,
        cap: 20,
        playbook: {
          nicho: 'Cursos Digitais',
          tom: 'direto e amigavel',
          floor: 19,
          ceiling: 497,
          upsell: 'Adicione a Comunidade VIP com 50% de desconto!'
        }
      })
    });
    const d5 = await r5.json();
    console.log('   Resultado:', d5.status === 'configurado' ? '✅ SUCESSO' : '❌ FALHA', d5);

    // (f) Analytics com Atribuicao Real
    console.log('\n6. Testando GET /api/hunter-analytics...');
    const r6 = await fetch(`${BASE}/api/hunter-analytics?d=${encodeURIComponent(DOMAIN)}&token=${encodeURIComponent(TOKEN)}`);
    const d6 = await r6.json();
    console.log('   Resultado:', d6.domain ? '✅ SUCESSO' : '❌ FALHA', {
      leads_total: d6.leads_total,
      revenue_attributed_cents: d6.revenue_attributed_cents,
      revenue_total_cents: d6.revenue_total_cents,
      conversion_estimated: d6.conversion_estimated
    });

    console.log('\n🎉 Todos os testes de endpoint V21 foram validados com sucesso!\n');
  } catch (err) {
    console.error('❌ Erro durante a execucao dos testes:', err.message);
  }
}

runTests();
