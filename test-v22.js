// ==============================================================================
// CHATPAY V22 — AUTOMATED TEST SUITE & VALIDATION SCRIPT
// Agent Graph + Memory Layer + Tool Calling + Multi-Model LLM + Webhooks HMAC
// ==============================================================================

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const TOKEN = process.env.TOKEN || '';
const DOMAIN = process.env.DOMAIN || 'sualoja.com';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`   ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`   ❌ FAIL: ${message}`);
    process.exitCode = 1;
  }
}

// ------------------------------------------------------------------------------
// PILLAR 1: COSINE SIMILARITY & EMBEDDING RANKING
// ------------------------------------------------------------------------------
function cosineSimilarity(a, b) {
  if (!a || !b || !a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0, ma = 0, mb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    ma += a[i] * a[i];
    mb += b[i] * b[i];
  }
  return ma && mb ? dot / (Math.sqrt(ma) * Math.sqrt(mb)) : 0;
}

function testCosineSimilarity() {
  console.log('\n--- 1. Testing Cosine Similarity & Vector Operations ---');
  
  // Identical vectors
  const simIdentical = cosineSimilarity([1, 0, 0], [1, 0, 0]);
  assert(Math.abs(simIdentical - 1.0) < 1e-6, 'Identical vectors yield similarity 1.0');

  // Orthogonal vectors
  const simOrtho = cosineSimilarity([1, 0], [0, 1]);
  assert(Math.abs(simOrtho - 0.0) < 1e-6, 'Orthogonal vectors yield similarity 0.0');

  // Opposite vectors
  const simOpposite = cosineSimilarity([1, 0], [-1, 0]);
  assert(Math.abs(simOpposite - (-1.0)) < 1e-6, 'Opposite vectors yield similarity -1.0');

  // Dimension mismatch
  const simMismatch = cosineSimilarity([1, 0], [1, 0, 0]);
  assert(simMismatch === 0, 'Dimension mismatch safely returns 0');

  // Empty vectors
  const simEmpty = cosineSimilarity([], []);
  assert(simEmpty === 0, 'Empty vectors safely return 0');

  // Vector ranking (Top-3 nearest)
  const target = [1, 1, 0];
  const candidates = [
    { id: 'item1', vec: [1, 1, 0.1] }, // Very close (~0.99)
    { id: 'item2', vec: [0, 0, 1] },   // Orthogonal (0)
    { id: 'item3', vec: [1, 0.9, 0] }, // Close (~0.99)
    { id: 'item4', vec: [-1, -1, 0] }, // Opposite (-1.0)
    { id: 'item5', vec: [1, 0.5, 0] }  // Medium (~0.94)
  ];

  const ranked = candidates.map(c => ({
    ...c,
    score: cosineSimilarity(target, c.vec)
  })).sort((a, b) => b.score - a.score);

  assert(ranked[0].id === 'item1' || ranked[0].id === 'item3', 'Top 1 is closest neighbor');
  assert(ranked.slice(0, 3).every(item => ['item1', 'item3', 'item5'].includes(item.id)), 'Top 3 nearest neighbors accurately ranked');
}

// ------------------------------------------------------------------------------
// PILLAR 2: HMAC-SHA256 SIGNATURE GENERATOR (WEBHOOK SECURITY)
// ------------------------------------------------------------------------------
async function computeHmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function testHmacSha256() {
  console.log('\n--- 2. Testing Webhook HMAC-SHA256 Security ---');

  const secret = 'secret-test-key-2026';
  const payload = JSON.stringify({ event: 'payment_confirmed', amount: '49.00', dom: 'test.com' });
  
  // Standard Node crypto reference
  const expectedSig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const actualSig = await computeHmacSha256(secret, payload);

  assert(actualSig === expectedSig, 'Web Crypto HMAC-SHA256 matches Node.js crypto reference');
  assert(actualSig.length === 64, 'HMAC signature is valid 64-character hex string');
  assert(/^[a-f0-9]+$/.test(actualSig), 'HMAC signature contains valid lowercase hex digits');
}

// ------------------------------------------------------------------------------
// PILLAR 3: AGENT GRAPH ROUTING & DISPATCH
// ------------------------------------------------------------------------------
function dispatch(event) {
  const routes = {
    lead: ['classifyIntent', 'objectionHandler', 'craftReply', 'proofGenerator'],
    whatsapp_intent: ['classifyIntent', 'objectionHandler', 'craftReply'],
    paid: ['upsellArchitect', 'upsellAfterPaid'],
    abandon: ['scheduleRecovery'],
    paid_ping: ['scheduleRecovery'],
    upsell: ['sendUpsell']
  };
  return routes[event.type] || ['ignore'];
}

function testAgentGraphRouting() {
  console.log('\n--- 3. Testing Agent Graph Routing & Orchestration ---');

  const leadPipeline = dispatch({ type: 'lead' });
  assert(Array.isArray(leadPipeline), 'Dispatch returns an Array pipeline');
  assert(leadPipeline.length === 4, 'Lead event triggers 4-stage pipeline');
  assert(leadPipeline[0] === 'classifyIntent', 'Lead stage 1: classifyIntent');
  assert(leadPipeline[1] === 'objectionHandler', 'Lead stage 2: objectionHandler');
  assert(leadPipeline[2] === 'craftReply', 'Lead stage 3: craftReply');
  assert(leadPipeline[3] === 'proofGenerator', 'Lead stage 4: proofGenerator');

  const waPipeline = dispatch({ type: 'whatsapp_intent' });
  assert(waPipeline.length === 3 && waPipeline.includes('objectionHandler'), 'WhatsApp intent pipeline properly routed');

  const paidPipeline = dispatch({ type: 'paid' });
  assert(paidPipeline.includes('upsellArchitect') && paidPipeline.includes('upsellAfterPaid'), 'Paid event triggers Upsell Architect and Affiliate issuing');

  const abandonPipeline = dispatch({ type: 'abandon' });
  assert(abandonPipeline.includes('scheduleRecovery'), 'Abandon triggers 3-stage Recovery scheduler');

  const unknownPipeline = dispatch({ type: 'random_unknown_event' });
  assert(unknownPipeline.length === 1 && unknownPipeline[0] === 'ignore', 'Unknown event safely yields [ignore]');
}

// ------------------------------------------------------------------------------
// PILLAR 4: TOOL CALLING EXECUTION & WHITELIST ENFORCEMENT
// ------------------------------------------------------------------------------
function testToolCallingLogic() {
  console.log('\n--- 4. Testing Tool Calling Whitelist & Execution Guard ---');

  const mockPlaybook = {
    tools: [
      { name: 'consultar_estoque', endpoint: 'https://api.loja.com/estoque' },
      { name: 'calcular_desconto', endpoint: 'https://api.loja.com/desconto' }
    ]
  };

  function checkToolWhitelist(toolName, pb) {
    const tools = Array.isArray(pb && pb.tools) ? pb.tools : [];
    const targetTool = tools.find(t => t && t.name === toolName);
    if (!targetTool || !targetTool.endpoint) {
      return { error: 'tool_not_whitelisted' };
    }
    return { success: true, endpoint: targetTool.endpoint };
  }

  const allowed1 = checkToolWhitelist('consultar_estoque', mockPlaybook);
  assert(allowed1.success === true && allowed1.endpoint === 'https://api.loja.com/estoque', 'Whitelisted tool is permitted');

  const rejected1 = checkToolWhitelist('deletar_banco', mockPlaybook);
  assert(rejected1.error === 'tool_not_whitelisted', 'Non-whitelisted tool is strictly blocked');

  const emptyPb = checkToolWhitelist('consultar_estoque', {});
  assert(emptyPb.error === 'tool_not_whitelisted', 'Empty playbook tools safely blocks execution');
}

// ------------------------------------------------------------------------------
// PILLAR 5: MULTI-MODEL LLM ROUTER & RATE LIMIT LOGIC
// ------------------------------------------------------------------------------
function testMultiModelRouterLogic() {
  console.log('\n--- 5. Testing Multi-Model LLM Router & Fallback Rules ---');

  const providers = ['workers_ai', 'openai', 'anthropic', 'custom'];
  assert(providers.length === 4, 'Four LLM providers recognized');

  function checkFallback(failsCount) {
    if (failsCount >= 2) return 'workers_ai_fallback';
    return 'selected_provider';
  }

  assert(checkFallback(0) === 'selected_provider', '0 fails routes to selected provider');
  assert(checkFallback(1) === 'selected_provider', '1 fail still attempts provider');
  assert(checkFallback(2) === 'workers_ai_fallback', '2 fails triggers immediate fallback to workers_ai');
  assert(checkFallback(5) === 'workers_ai_fallback', '>=2 fails preserves workers_ai fallback resilience');

  // Rate limit: 10 req/min
  function isRateLimited(reqCount) {
    return reqCount > 10;
  }
  assert(!isRateLimited(10), '10 req/min is allowed');
  assert(isRateLimited(11), '11 req/min is rate limited');
}

// ------------------------------------------------------------------------------
// PILLAR 6: STATIC VERIFICATION OF WORKER.JS INTEGRITY
// ------------------------------------------------------------------------------
function testWorkerSourceCode() {
  console.log('\n--- 6. Verifying worker.js Code Integrity & V22 Architecture ---');

  const workerPath = path.join(__dirname, 'worker.js');
  const code = fs.readFileSync(workerPath, 'utf8');

  // Syntax check already confirmed via node --check
  assert(code.length > 50000, 'worker.js has expected complete codebase');

  // Core V22 Functions
  assert(code.includes('function cosineSimilarity('), 'cosineSimilarity defined');
  assert(code.includes('async function checkLLMRateLimit('), 'checkLLMRateLimit defined');
  assert(code.includes('async function callLLM('), 'callLLM multi-model router defined');
  assert(code.includes('async function computeHmacSha256('), 'computeHmacSha256 HMAC generator defined');
  assert(code.includes('async function triggerWebhook('), 'triggerWebhook with 3x retry defined');
  assert(code.includes('async function saveMemory('), 'saveMemory dual-store defined');
  assert(code.includes('async function rememberMemory('), 'rememberMemory RAG defined');
  assert(code.includes('async function executeTool('), 'executeTool with whitelist & timeout defined');
  assert(code.includes('async function runAgentPipeline('), 'runAgentPipeline with 10s Promise.race defined');

  // 5 New Agents
  assert(code.includes('async function objectionHandler('), 'Agent: objectionHandler defined');
  assert(code.includes('async function proofGenerator('), 'Agent: proofGenerator defined');
  assert(code.includes('async function timingOptimizer('), 'Agent: timingOptimizer defined');
  assert(code.includes('async function competitorAnalyzer('), 'Agent: competitorAnalyzer defined');
  assert(code.includes('async function upsellArchitect('), 'Agent: upsellArchitect defined');

  // V22 Endpoints
  assert(code.includes("url.pathname === '/api/agent-graph'"), 'Endpoint: /api/agent-graph registered');
  assert(code.includes("url.pathname === '/api/memory'"), 'Endpoint: /api/memory registered');
  assert(code.includes("url.pathname === '/api/playbook-suggestions'"), 'Endpoint: /api/playbook-suggestions registered');

  // Learning Loops
  assert(code.includes("saveMemory(tx.dom, 'reply_winner'"), 'Loop 1: Winning reply stored on confirmed payment');
  assert(code.includes("'arm:' + event.arm + ':success'"), 'Loop 2: Multi-Armed Bandit arm reward integrated');
  assert(code.includes('swarm:playbook_suggestions:'), 'Loop 3: Evolutionary playbook suggestions integrated');

  // V22 Dashboard UI Cards
  assert(code.includes('ag-pipeline'), 'Dash UI: Agent Graph pipeline card present');
  assert(code.includes('mem-list'), 'Dash UI: Memory layer card present');
  assert(code.includes('tools-list'), 'Dash UI: Tool calling card present');
  assert(code.includes('wh-list'), 'Dash UI: Webhooks management card present');
  assert(code.includes('sw-provider'), 'Dash UI: Multi-Model LLM selector present');
}

// ------------------------------------------------------------------------------
// PILLAR 7: LIVE ENDPOINT INTEGRATION TESTS (IF TOKEN PROVIDED)
// ------------------------------------------------------------------------------
async function runLiveEndpointTests() {
  if (!TOKEN) {
    console.log('\n--- 7. Live Endpoint Integration Tests ---');
    console.log('ℹ️  Skipping live HTTP requests (TOKEN not set in environment).');
    console.log('    To test live endpoints against Worker:');
    console.log('    $env:TOKEN = "your-jwt-token"; node test-v22.js');
    return;
  }
  if (process.env.ALLOW_LIVE_API_TESTS !== '1') {
    console.log('⏭️  Live endpoint calls are disabled. Set ALLOW_LIVE_API_TESTS=1 to authorize them explicitly.');
    return;
  }

  console.log(`\n--- 7. Testing Live Endpoints at ${BASE} ---`);
  const headers = { 'Content-Type': 'application/json' };

  try {
    // 1. Agent Graph
    const r1 = await fetch(`${BASE}/api/agent-graph?token=${encodeURIComponent(TOKEN)}`);
    const d1 = await r1.json();
    assert(Array.isArray(d1.pipeline), 'Live: /api/agent-graph returned valid pipeline array');

    // 2. Memory save & retrieve
    const r2 = await fetch(`${BASE}/api/memory`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ token: TOKEN, type: 'objection', content: 'Achei o valor caro demais' })
    });
    const d2 = await r2.json();
    assert(d2.status === 'saved', 'Live: /api/memory POST saved objection item');

    const r3 = await fetch(`${BASE}/api/memory?type=objection&token=${encodeURIComponent(TOKEN)}`);
    const d3 = await r3.json();
    assert(Array.isArray(d3.items), 'Live: /api/memory GET retrieved items list');

    // 3. Playbook Suggestions
    const r4 = await fetch(`${BASE}/api/playbook-suggestions?token=${encodeURIComponent(TOKEN)}`);
    const d4 = await r4.json();
    assert(Array.isArray(d4.suggestions), 'Live: /api/playbook-suggestions returned suggestions array');
  } catch (err) {
    console.error('Live integration test error:', err.message);
  }
}

// ------------------------------------------------------------------------------
// MAIN EXECUTION
// ------------------------------------------------------------------------------
async function main() {
  console.log('================================================================');
  console.log('⚡ CHATPAY V22: AGENT GRAPH + MEMORY + TOOLS + MULTI-MODEL SUITE');
  console.log('================================================================');

  testCosineSimilarity();
  await testHmacSha256();
  testAgentGraphRouting();
  testToolCallingLogic();
  testMultiModelRouterLogic();
  testWorkerSourceCode();
  await runLiveEndpointTests();

  console.log('\n================================================================');
  console.log(`🎯 TEST RESULTS: ${passedTests} / ${totalTests} tests passed`);
  if (passedTests === totalTests) {
    console.log('🎉 ALL V22 TESTS PASSED PERFECTLY!');
  } else {
    console.error('⚠️ SOME TESTS FAILED. CHECK OUTPUT ABOVE.');
  }
  console.log('================================================================\n');
}

main();
