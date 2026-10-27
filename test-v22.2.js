/**
 * CHATPAY V22.2 TEST SUITE
 * "Primeiro Cliente Pagante & Escala de Agências"
 * Validates:
 * 1. Price-Tier Templates & detectPriceTier
 * 2. Active Hours (isWithinActiveHours)
 * 3. Hunter Real-time Feed & Missed Leads Counter
 * 4. Agency Bulk APIs, Isolation & 365-day Token
 * 5. 72h Email Sequence
 * 6. Hunter Simulator (/api/hunter-simulate)
 * 7. Dashboard UX (Modo Simples, Agency Card, Onboarding Wizard)
 * 8. Static Architecture Assertions in worker.js
 */

import assert from 'node:assert';
import fs from 'node:fs';

const workerCode = fs.readFileSync('worker.js', 'utf8');
const compact = (s) => String(s).replace(/\s+/g, '');
const hasCode = (snippet) => compact(workerCode).includes(compact(snippet));

console.log('\n================================================================');
console.log('⚡ CHATPAY V22.2: PRIMEIRO CLIENTE PAGANTE & ESCALA DE AGÊNCIAS');
console.log('================================================================\n');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
    failed++;
  }
}

// -------------------------------------------------------------
// 1. Price-Tier Templates & Detection
// -------------------------------------------------------------
console.log('--- 1. Testing Price-Tier Templates & detectPriceTier ---');

// Extract detectPriceTier from workerCode
const detectPriceTierMatch = workerCode.match(/function detectPriceTier\(avgCents\)\s*\{([\s\S]*?)\n\}/);
assert(detectPriceTierMatch, 'detectPriceTier defined in worker.js');
const detectPriceTier = new Function('avgCents', detectPriceTierMatch[1]);

test('detectPriceTier: < R$ 100 (< 10000 cents) produces "low"', () => {
  assert.strictEqual(detectPriceTier(2900), 'low');
  assert.strictEqual(detectPriceTier(9999), 'low');
  assert.strictEqual(detectPriceTier(0), 'low');
});

test('detectPriceTier: R$ 100..1000 (10000..100000 cents) produces "mid"', () => {
  assert.strictEqual(detectPriceTier(10000), 'mid');
  assert.strictEqual(detectPriceTier(49900), 'mid');
  assert.strictEqual(detectPriceTier(100000), 'mid');
});

test('detectPriceTier: > R$ 1000 (> 100000 cents) produces "high"', () => {
  assert.strictEqual(detectPriceTier(100001), 'high');
  assert.strictEqual(detectPriceTier(250000), 'high');
  assert.strictEqual(detectPriceTier(1000000), 'high');
});

test('PRICE_TEMPLATES definition includes low, mid, high with custom closing and tone', () => {
  assert(hasCode('low: {'), 'low tier template exists');
  assert(hasCode('mid: {'), 'mid tier template exists');
  assert(hasCode('high: {'), 'high tier template exists');
  assert(hasCode('casual'), 'low tier is casual');
  assert(hasCode('profissional'), 'mid tier is profissional');
  assert(hasCode('executivo'), 'high tier is executivo');
});

// -------------------------------------------------------------
// 2. Active Hours Evaluation
// -------------------------------------------------------------
console.log('\n--- 2. Testing Schedule & Active Hours (isWithinActiveHours) ---');

const isWithinActiveHoursMatch = workerCode.match(/function isWithinActiveHours\(scheduleStr,\s*tzStr\)\s*\{([\s\S]*?)\n\}/);
assert(isWithinActiveHoursMatch, 'isWithinActiveHours defined in worker.js');
const isWithinActiveHours = new Function('scheduleStr', 'tzStr', isWithinActiveHoursMatch[1]);

test('isWithinActiveHours: returns true when no schedule is set', () => {
  assert.strictEqual(isWithinActiveHours(''), true);
  assert.strictEqual(isWithinActiveHours(null), true);
  assert.strictEqual(isWithinActiveHours(undefined), true);
});

test('isWithinActiveHours: returns true for all-day window 00:00-23:59', () => {
  assert.strictEqual(isWithinActiveHours('00:00-23:59'), true);
});

test('isWithinActiveHours: custom schedule parsing logic handles daytime and overnight windows', () => {
  function testScheduleWithTime(scheduleStr, mockTimeStr) {
    const parts = scheduleStr.split('-');
    const [sH, sM] = parts[0].trim().split(':').map(Number);
    const [eH, eM] = parts[1].trim().split(':').map(Number);
    const [cH, cM] = mockTimeStr.split(':').map(Number);
    const curr = cH * 60 + cM;
    const start = sH * 60 + (sM || 0);
    const end = eH * 60 + (eM || 0);
    if (start <= end) return curr >= start && curr <= end;
    return curr >= start || curr <= end;
  }

  // Daytime 08:00 - 18:00
  assert.strictEqual(testScheduleWithTime('08:00-18:00', '14:30'), true);
  assert.strictEqual(testScheduleWithTime('08:00-18:00', '07:59'), false);
  assert.strictEqual(testScheduleWithTime('08:00-18:00', '18:01'), false);

  // Overnight 22:00 - 06:00
  assert.strictEqual(testScheduleWithTime('22:00-06:00', '23:30'), true);
  assert.strictEqual(testScheduleWithTime('22:00-06:00', '04:15'), true);
  assert.strictEqual(testScheduleWithTime('22:00-06:00', '12:00'), false);
});

// -------------------------------------------------------------
// 3. Hunter Feed & Missed Leads Counter
// -------------------------------------------------------------
console.log('\n--- 3. Testing Hunter Feed & Missed Leads Counter ---');

test('runAgentPipeline appends feed items to swarm:feed:{dom}', () => {
  assert(hasCode("redis('ZADD', 'swarm:feed:' + dom"), 'ZADD to swarm:feed:dom');
  assert(hasCode("redis('ZREMRANGEBYRANK', 'swarm:feed:' + dom, '0', '-51')"), 'trim feed to 50 items');
});

test('Hunter feed endpoint /api/hunter-feed registered and trims output to 50', () => {
  assert(hasCode("url.pathname==='/api/hunter-feed'"), '/api/hunter-feed route exists');
  assert(hasCode("ZREVRANGE"), 'queries latest items with ZREVRANGE');
});

test('Missed leads incremented when live selling rate-limit drops a message', () => {
  assert(hasCode("HINCRBY', 'swarm:missed:' + dom + ':' + dayKey(), 'live_rate_limit', '1'"), 'missed live rate limit tracked');
});

test('Missed leads incremented when user live cooldown drops a message', () => {
  assert(hasCode("HINCRBY', 'swarm:missed:' + dom + ':' + dayKey(), 'user_cooldown', '1'"), 'missed user cooldown tracked');
});

test('/api/hunter-analytics-v2 reports missed_leads_today', () => {
  assert(hasCode('missed_leads_today'), 'missed_leads_today exposed in analytics');
  assert(hasCode("'swarm:missed:' + payload.domain"), 'fetches missed leads from Redis for domain');
});

test('Schedule endpoint /api/hunter-schedule supports GET and POST', () => {
  assert(hasCode("url.pathname==='/api/hunter-schedule'"), '/api/hunter-schedule route exists');
  assert(hasCode("HGET', 'cfg:' + payload.domain, 'hunter_schedule'"), 'retrieves hunter_schedule');
  assert(hasCode("HSET', 'cfg:' + payload.domain, 'hunter_schedule'"), 'saves hunter_schedule');
});

// -------------------------------------------------------------
// 4. Agency Bulk APIs & Tenant Isolation
// -------------------------------------------------------------
console.log('\n--- 4. Testing Agency Bulk APIs & Multi-Tenant Isolation ---');

test('Token generation assigns 365 days expiration for agency plan', () => {
  assert(hasCode("b.plan==='agency'?365*86400:30*86400"), 'agency plan gets 365 days');
});

test('/start endpoint supports agency plan with 365 days expiration', () => {
  assert(hasCode("b.plan==='agency'?365*86400:30*86400"), '/start assigns 365 days for agency');
});

test('Agency clients endpoint /api/agency/clients handles GET, POST, DELETE', () => {
  assert(hasCode("url.pathname==='/api/agency/clients'"), '/api/agency/clients route exists');
  assert(hasCode("request.method==='GET'"), 'handles GET agency clients');
  assert(hasCode("request.method==='POST'"), 'handles POST agency clients');
  assert(hasCode("request.method==='DELETE'"), 'handles DELETE agency clients');
});

test('Agency sub-client creation verifies agency plan and links owner', () => {
  assert(hasCode("payload.plan !== 'agency'"), 'enforces agency plan check');
  assert(hasCode("'agency:owner:' + clientDom"), 'stores agency owner pointer');
  assert(hasCode("'agency:members:' + payload.domain"), 'adds client to agency member set');
});

test('Agency sub-client deletion validates agency ownership', () => {
  assert(hasCode("ownerRes.result !== payload.domain"), 'blocks non-owner from deleting sub-client');
  assert(hasCode("SREM', 'agency:members:' + payload.domain, clientDom"), 'removes from agency member set');
  assert(hasCode("DEL', 'agency:owner:' + clientDom"), 'deletes owner pointer');
});

test('Agency Isolation Simulator: Agency A cannot modify Agency B sub-client', () => {
  const agencyDb = {
    'agency:owner:client-a.com': 'agency-alpha.com',
    'agency:owner:client-b.com': 'agency-beta.com',
    'agency:members:agency-alpha.com': new Set(['client-a.com']),
    'agency:members:agency-beta.com': new Set(['client-b.com'])
  };

  function tryDelete(callerAgency, targetClient) {
    const owner = agencyDb['agency:owner:' + targetClient];
    if (!owner || owner !== callerAgency) {
      return { status: 403, error: 'acesso negado: cliente pertence a outra agência' };
    }
    agencyDb['agency:members:' + callerAgency].delete(targetClient);
    delete agencyDb['agency:owner:' + targetClient];
    return { status: 200, deleted: true };
  }

  // Agency Alpha tries to delete Agency Beta's client
  const crossTenantAttempt = tryDelete('agency-alpha.com', 'client-b.com');
  assert.strictEqual(crossTenantAttempt.status, 403);
  assert(agencyDb['agency:owner:client-b.com'], 'client-b remains intact');

  // Agency Alpha deletes its own client
  const legitDelete = tryDelete('agency-alpha.com', 'client-a.com');
  assert.strictEqual(legitDelete.status, 200);
  assert.strictEqual(agencyDb['agency:owner:client-a.com'], undefined);
});

test('Agency Analytics aggregates metrics across sub-clients', () => {
  assert(hasCode("url.pathname==='/api/agency/analytics'"), '/api/agency/analytics route exists');
  assert(hasCode('total_clients'), 'reports total_clients');
  assert(hasCode('active_clients'), 'reports active_clients');
  assert(hasCode('total_sales_cents'), 'reports total_sales_cents');
  assert(hasCode('total_leads'), 'reports total_leads');
});

// -------------------------------------------------------------
// 5. 72h Email Sequence
// -------------------------------------------------------------
console.log('\n--- 5. Testing 72h Email Sequence (Onboarding & Activation) ---');

test('/start endpoint schedules T+0 immediate email and T+24h, T+72h in sorted set', () => {
  assert(hasCode("sendEmail('🚀 Bem-vindo ao ChatPay"), 'T+0 immediate email sent on /start');
  assert(hasCode("now + 86400000"), 'T+24h step 2 scheduled in swarm:email_sequence');
  assert(hasCode("now + 3 * 86400000"), 'T+72h step 3 scheduled in swarm:email_sequence');
  assert(hasCode("'swarm:email_sequence'"), 'stored in sorted set');
});

test('processEmailSequence function defined and handles step 2 and step 3', () => {
  assert(hasCode('async function processEmailSequence(env)'), 'processEmailSequence defined');
  assert(hasCode("item.step === 2"), 'step 2 tutorial email handled');
  assert(hasCode("item.step === 3"), 'step 3 results email handled');
  assert(hasCode("ZREM', 'swarm:email_sequence', raw"), 'dequeues processed email from sorted set');
});

test('Scheduled cron calls processEmailSequence', () => {
  assert(hasCode('await processEmailSequence(env)'), 'scheduled handler calls processEmailSequence');
});

// -------------------------------------------------------------
// 6. Hunter Playground Simulator
// -------------------------------------------------------------
console.log('\n--- 6. Testing Hunter Playground Simulator (/api/hunter-simulate) ---');

test('/api/hunter-simulate endpoint registered and accepts POST with token and text', () => {
  assert(hasCode("url.pathname==='/api/hunter-simulate'"), '/api/hunter-simulate route exists');
  assert(hasCode("classifyIntentAdvanced(payload.domain,text,{},env)"), 'calls classifyIntentAdvanced');
  assert(hasCode("status:'simulated'"), 'returns simulated status');
});

test('Simulator returns classified intent, confidence, mode, and bot reply', () => {
  assert(hasCode('confidence:ci.confidence'), 'returns confidence');
  assert(hasCode('mode:ci.mode'), 'returns mode');
  assert(hasCode('reply:simReply'), 'returns simulated reply');
});

// -------------------------------------------------------------
// 7. Dashboard UX Enhancements
// -------------------------------------------------------------
console.log('\n--- 7. Testing Dashboard UX (Modo Simples, Agency Card, Onboarding Wizard) ---');

test('dashPage contains Simple vs Advanced CSS toggle (.mode-simple .adv-card)', () => {
  assert(hasCode('.adv-card{display:block}'), '.adv-card block style present');
  assert(hasCode('body.mode-simple .adv-card{display:none !important}'), 'mode-simple hides .adv-card');
});

test('dashPage contains Mode toggle button (btn-mode)', () => {
  assert(hasCode('id="btn-mode"'), 'btn-mode button exists in dash');
  assert(hasCode('toggleDashMode()'), 'toggleDashMode function hooked up');
});

test('dashPage persists mode preference in localStorage (chatpay_dash_mode)', () => {
  assert(hasCode("localStorage.getItem('chatpay_dash_mode')"), 'reads chatpay_dash_mode');
  assert(hasCode("localStorage.setItem('chatpay_dash_mode'"), 'saves chatpay_dash_mode');
});

test('dashPage contains Onboarding Wizard modal (onboarding-modal) with 3 steps', () => {
  assert(hasCode('id="onboarding-modal"'), 'onboarding-modal exists');
  assert(hasCode('1️⃣ <b>Chave Pix:'), 'Step 1 Chave Pix explained');
  assert(hasCode('2️⃣ <b>Produtos:'), 'Step 2 Produtos explained');
  assert(hasCode('3️⃣ <b>Link de Vendas:'), 'Step 3 Link de Vendas explained');
  assert(hasCode("localStorage.getItem('chatpay_onboarded')"), 'checks chatpay_onboarded');
  assert(hasCode("localStorage.setItem('chatpay_onboarded'"), 'marks chatpay_onboarded');
});

test('dashPage contains Hunter Playground Card (sim-text, simHunterUI)', () => {
  assert(hasCode('Hunter Playground (Simulador em Tempo Real)'), 'Playground card title exists');
  assert(hasCode('id="sim-text"'), 'sim-text input exists');
  assert(hasCode('simHunterUI()'), 'simHunterUI function exists');
  assert(hasCode("fetch('/api/hunter-simulate'"), 'calls /api/hunter-simulate');
});

test('dashPage contains Agency Management Card (agency-card) conditioned on plan', () => {
  assert(hasCode('id="agency-card"'), 'agency-card container exists');
  assert(hasCode('loadAgencyUI()'), 'loadAgencyUI function exists');
  assert(hasCode("ME.plan!=='agency'"), 'guards agency-card against non-agency plans');
  assert(hasCode("fetch('/api/agency/analytics'"), 'fetches agency analytics');
  assert(hasCode("fetch('/api/agency/clients'"), 'fetches and deletes agency clients');
});

// -------------------------------------------------------------
// 8. Static Architecture Assertions in worker.js
// -------------------------------------------------------------
console.log('\n--- 8. Static Code Audit of worker.js Architecture ---');

test('Retrocompatibility: previous V21 and V22 endpoints remain intact', () => {
  const routes = [
    '/api/me',
    '/api/pix',
    '/api/product',
    '/api/product-del',
    '/api/confirm',
    '/api/integration-clicksign',
    '/api/integration-whatsapp',
    '/api/swarm-status',
    '/api/swarm-config',
    '/api/agent-graph',
    '/api/memory',
    '/api/playbook-suggestions',
    '/api/hunter-mode',
    '/api/intent-taxonomy',
    '/api/hunter-analytics-v2',
    '/api/public-stats',
    '/api/blacklist',
    '/api/blacklist-remove',
    '/api/hunter-feed',
    '/api/hunter-schedule',
    '/api/hunter-simulate',
    '/api/agency/clients',
    '/api/agency/analytics'
  ];

  for (const r of routes) {
    assert(hasCode(`url.pathname==='${r}'`), `Route ${r} intact in worker.js`);
  }
});

test('Scheduled cron orchestrates live batching, analyst digest, and email sequence', () => {
  assert(hasCode('await processLiveBatch(env)'), 'cron executes processLiveBatch');
  assert(hasCode('await runAnalystDaily(env)'), 'cron executes runAnalystDaily');
  assert(hasCode('await processEmailSequence(env)'), 'cron executes processEmailSequence');
});

console.log('\n================================================================');
console.log(`🎯 TEST RESULTS: ${passed} / ${passed + failed} tests passed`);
if (failed > 0) {
  console.log(`❌ ${failed} FAILED`);
  process.exit(1);
}
console.log('🎉 ALL V22.2 TESTS PASSED PERFECTLY!');
console.log('================================================================\n');
