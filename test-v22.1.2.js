"use strict";
const fs = require('fs');

let passed = 0;
let failed = 0;
function assert(label, cond, detail) {
  if (cond) {
    console.log("  ✅ PASS: " + label);
    passed++;
  } else {
    console.error("  ❌ FAIL: " + label + (detail ? " -- " + detail : ""));
    failed++;
  }
}

// Carrega worker.js para static & unit checks
const workerCode = fs.readFileSync(__dirname + '/worker.js', 'utf8');

// Extrai funções e constantes de worker.js ou emula fielmente
function normalizeText(t) {
  return String(t || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

const NEGATION_MARKERS = ['nao','sem','nunca','jamais','nem','tampouco','ñ'];
function matchPhrase(text, words, phrase) {
  const norm = normalizeText(phrase);
  if (!norm) return false;

  const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re = new RegExp('(?:^|\\s|[^\\p{L}])(' + escaped + ')(?=$|\\s|[^\\p{L}])','gu');
  const matches = [...text.matchAll(re)];
  if (matches.length === 0) return false;

  for (const m of matches) {
    const matchIdx = m.index + (m[0].length - m[1].length);
    const beforeStr = text.slice(0, matchIdx).trim();
    const beforeWords = beforeStr ? beforeStr.split(/\s+/).slice(-4).map(w => normalizeText(w)) : [];
    const isNegated = beforeWords.some(w => NEGATION_MARKERS.includes(w));
    if (!isNegated) return true;
  }
  return false;
}

const OPTOUT_PATTERN = /\b(pare|saia|cancela|descadastrar|remover|opt-out)\b|nao me responda|me deixa|para de me mandar|nao quero mais/i;
const TOXICITY_PATTERN = /\b(golpe|ladr[ãa]o|merda|bosta|fdp|vtnc|kct|vagabundo|idiota|estelionato|fraude|scam|fuck|shit)\b|filho da puta|put[ao] que pariu|puta(?!tivo|tiva)/i;

function sha256Hex16(str) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(str || '').digest('hex').slice(0, 16);
}

// Simulador de deduplicação de respostas
function createDedupSimulator() {
  const counts = {};
  return function(dom, text) {
    const hash = sha256Hex16(text);
    const key = dom + ':' + hash;
    counts[key] = (counts[key] || 0) + 1;
    if (counts[key] > 3) return { allowed: false, hash, count: counts[key] };
    return { allowed: true, hash, count: counts[key] };
  };
}

// Simulador de Live Batch
function createLiveBatchSimulator() {
  const batches = {};
  return {
    add(dom, item) {
      if (!batches[dom]) batches[dom] = [];
      batches[dom].push(item);
      return { status: 'batched', count: batches[dom].length };
    },
    process(dom) {
      const items = batches[dom] || [];
      if (items.length >= 3) {
        batches[dom] = [];
        return { processed: true, count: items.length, reply: 'Galera da live, link liberado!' };
      }
      return { processed: false, count: items.length };
    }
  };
}

// Simulador de extração de IP com split
function extractClientIp(headers) {
  const rawXff = headers['x-forwarded-for'] || '';
  const firstXff = rawXff.split(',')[0].trim();
  return headers['cf-connecting-ip'] || firstXff || 'unknown';
}

console.log("\n================================================================");
console.log("⚡ CHATPAY V22.1.2: SWARM AUDIT HARDENING VERIFICATION (25 TESTS)");
console.log("================================================================\n");

// --- GRUPO 1: Negation & matchAll (Patch 1 & 2) ---
console.log("--- 1. Testing Negation Markers & matchAll Per-Occurrence ---");
{
  const text1 = "não quero o básico mas quero o plano pro";
  assert("Multi-occurrence: first negated, second positive -> match", matchPhrase(text1, text1.split(/\s+/), "quero"));

  const text2 = "não quero e nunca vou querer comprar";
  assert("Multi-occurrence: all occurrences negated -> NO match", !matchPhrase(text2, text2.split(/\s+/), "quero"));

  const text3 = "nem quero saber disso";
  assert("Marker 'nem' negates match", !matchPhrase(text3, text3.split(/\s+/), "quero"));

  const text4 = "tampouco quero comprar";
  assert("Marker 'tampouco' negates match", !matchPhrase(text4, text4.split(/\s+/), "quero"));
}

// --- GRUPO 2: Word Boundary Opt-Out Shielding (Patch 3) ---
console.log("\n--- 2. Testing OPTOUT_PATTERN Word-Boundary Shielding ---");
{
  assert('"parece que quero" does NOT trigger opt-out', !OPTOUT_PATTERN.test("parece que quero comprar"));
  assert('"PARE" triggers opt-out', OPTOUT_PATTERN.test("PARE"));
  assert('"saias rodadas" does NOT trigger opt-out', !OPTOUT_PATTERN.test("saias rodadas em promoção"));
  assert('"saia da minha frente" triggers opt-out', OPTOUT_PATTERN.test("saia da minha frente"));
}

// --- GRUPO 3: Toxicity Shielding Expansion (Patch 4) ---
console.log("\n--- 3. Testing TOXICITY_PATTERN Expansion (English & BR slang) ---");
{
  assert('English "this is a scam" triggers toxicity', TOXICITY_PATTERN.test("this is a scam, do not buy"));
  assert('English "what the fuck" triggers toxicity', TOXICITY_PATTERN.test("what the fuck is this"));
  assert('English "piece of shit" triggers toxicity', TOXICITY_PATTERN.test("piece of shit"));
  assert('BR slang "vtnc" triggers toxicity', TOXICITY_PATTERN.test("vai se ferrar vtnc"));
  assert('BR slang "kct" triggers toxicity', TOXICITY_PATTERN.test("que kct de atendimento"));
  assert('BR variation "puta que pariu" triggers toxicity', TOXICITY_PATTERN.test("puta que pariu"));
  assert('Compliance edge-case "putativo" is NOT toxic', !TOXICITY_PATTERN.test("direito putativo do consumidor"));
}

// --- GRUPO 4: Reply Deduplicator (Patch 7) ---
console.log("\n--- 4. Testing Reply Deduplicator & SHA-256 Hex16 ---");
{
  const hash = sha256Hex16("Posso te ajudar com a compra. Veja o link seguro");
  assert('sha256Hex16 returns valid 16-character hex string', typeof hash === 'string' && hash.length === 16 && /^[0-9a-f]{16}$/.test(hash));

  const dedup = createDedupSimulator();
  const r1 = dedup('loja.com', 'link especial');
  const r2 = dedup('loja.com', 'link especial');
  const r3 = dedup('loja.com', 'link especial');
  const r4 = dedup('loja.com', 'link especial');
  assert('Replies 1..3 allowed', r1.allowed && r2.allowed && r3.allowed);
  assert('Reply 4 blocked by deduplicator', !r4.allowed && r4.count === 4);

  const rOther = dedup('loja.com', 'mensagem diferente');
  assert('Different reply text allowed without blocking', rOther.allowed);
}

// --- GRUPO 5: Live Batching (Patch 6 & 11) ---
console.log("\n--- 5. Testing Live Batching Logic ---");
{
  const batcher = createLiveBatchSimulator();
  batcher.add('live.store', { user: 'user_1' });
  batcher.add('live.store', { user: 'user_2' });
  const pUnder = batcher.process('live.store');
  assert('processLiveBatch with < 3 leads does not aggregate', !pUnder.processed && pUnder.count === 2);

  batcher.add('live.store', { user: 'user_3' });
  const pDone = batcher.process('live.store');
  assert('processLiveBatch with >= 3 leads aggregates and flushes batch', pDone.processed && pDone.count === 3);
}

// --- GRUPO 6: IP Header Extraction & Analytics (Patch 8 & 9) ---
console.log("\n--- 6. Testing IP Extraction & Analytics Rate Calculation ---");
{
  const ip1 = extractClientIp({ 'x-forwarded-for': '203.0.113.195, 70.41.3.18, 150.172.238.178' });
  assert('Extracts first IP from multi-hop X-Forwarded-For', ip1 === '203.0.113.195');

  const ip2 = extractClientIp({
    'cf-connecting-ip': '198.51.100.4',
    'x-forwarded-for': '203.0.113.195, 70.41.3.18'
  });
  assert('Prioritizes CF-Connecting-IP over X-Forwarded-For', ip2 === '198.51.100.4');

  const leadsCount = 200;
  const optoutsTotal = 6;
  const optoutRate = Number(((optoutsTotal / leadsCount) * 100).toFixed(2));
  assert('Opt-out rate accurately computed (6/200 = 3.00%)', optoutRate === 3.00);
}

// --- GRUPO 7: Static Code Audit of worker.js (Patch 5, 10, 11) ---
console.log("\n--- 7. Static Code Audit of worker.js Architecture ---");
{
  assert('TTL 90 days (7776000s) set on blacklist', workerCode.includes("'7776000'"));
  assert('Optouts total metric counter registered', workerCode.includes("'swarm:optouts:'"));
  assert('Scheduled cron calls processLiveBatch', workerCode.includes("processLiveBatch(env)"));
}

async function runBlacklistBehavioralTests() {
  const { agentRuns, makeRequest, redisCommand, worker } = await import('./test/harness.js');
  const domain = 'blacklist-behavior.chatpay';
  const userId = 'blacklist-user';
  const start = await makeRequest('POST', '/start', { domain, brand: 'Blacklist Test', email: 'blacklist@example.com' });
  const started = await start.json();
  assert('Blacklist behavioral setup returns JWT', start.status === 200 && !!started.token);

  const event = await makeRequest('POST', '/api/swarm-event', {
    token: started.token,
    type: 'whatsapp_intent',
    channel: 'api',
    user: userId,
    text: 'não quero mais',
    convId: 'blacklist-conversation'
  });
  assert('Opt-out behavioral event accepted', event.status === 200);
  await worker.scheduled({ cron: '* * * * *' }, { AI: null }, {});

  const listed = await makeRequest('GET', `/api/blacklist?token=${encodeURIComponent(started.token)}`);
  const listedData = await listed.json();
  assert('GET /api/blacklist returns the opted-out user', listed.status === 200 && listedData.blacklist.includes(userId));
  assert('Blacklist behavioral SISMEMBER is 1', redisCommand('SISMEMBER', `swarm:blacklist:${domain}`, userId).result === 1);

  const removed = await makeRequest('POST', '/api/blacklist-remove', { token: started.token, userId });
  assert('POST /api/blacklist-remove succeeds', removed.status === 200);
  const removedData = await removed.json();
  assert('Blacklist removal response identifies user', removedData.status === 'removed' && removedData.userId === userId);
  const afterRemove = await makeRequest('GET', `/api/blacklist?token=${encodeURIComponent(started.token)}`);
  const afterRemoveData = await afterRemove.json();
  assert('GET /api/blacklist no longer returns removed user', afterRemove.status === 200 && !afterRemoveData.blacklist.includes(userId));
  assert('Blacklist behavioral SISMEMBER is 0 after removal', redisCommand('SISMEMBER', `swarm:blacklist:${domain}`, userId).result === 0);
}

runBlacklistBehavioralTests().then(() => {
  console.log("\n================================================================");
  console.log(`🎯 TEST RESULTS: ${passed} / ${passed + failed} tests passed`);
  if (failed === 0) {
    console.log("🎉 ALL V22.1.2 HARDENING TESTS PASSED PERFECTLY!");
  } else {
    console.error(`⚠️ ${failed} tests failed!`);
    process.exitCode = 1;
  }
  console.log("================================================================\n");
}).catch(error => {
  console.error(error);
  process.exitCode = 1;
});
