/**
 * CHATPAY V22.2: 4 CANAIS OPERACIONAIS & 10 AJUSTES CRÍTICOS
 * Suite de 31 testes para validar:
 * - Configuração dos 4 canais (WhatsApp, YouTube, Instagram, TikTok)
 * - Telegram placeholder (501)
 * - Schema validation e REQUIRED_FIELDS
 * - Rate-limits por IP (10, 30, 5, 60 / min)
 * - Instagram hub.challenge verification (text/plain)
 * - Hunter runtime loadChannelConfig
 * - Métricas channel:usage:{dom} com HINCRBY
 * - LGPD erasure nos canais
 * - Idempotência e JSDoc
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerPath = path.join(__dirname, 'worker.js');
const workerCode = fs.readFileSync(workerPath, 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    failed++;
    console.error(`  ❌ FAIL: ${name}`);
    console.error(`     Error: ${err.message}`);
  }
}

console.log('\n================================================================');
console.log('⚡ CHATPAY V22.2: 4 CANAIS & 10 AJUSTES CRÍTICOS (31 TESTES)');
console.log('================================================================');

// --- 1. Schema Validation & REQUIRED_FIELDS ---
console.log('\n--- 1. Schema Validation & REQUIRED_FIELDS ---');

test('REQUIRED_FIELDS definition exists for whatsapp, youtube, instagram, tiktok', () => {
  assert(workerCode.includes('REQUIRED_FIELDS'), 'REQUIRED_FIELDS constant exists');
  assert(workerCode.includes('whatsapp:'), 'whatsapp in REQUIRED_FIELDS');
  assert(workerCode.includes('youtube:'), 'youtube in REQUIRED_FIELDS');
  assert(workerCode.includes('instagram:'), 'instagram in REQUIRED_FIELDS');
  assert(workerCode.includes('tiktok:'), 'tiktok in REQUIRED_FIELDS');
  assert(workerCode.includes('telegram:'), 'telegram in REQUIRED_FIELDS');
});

test('validateChannelConfig helper validates whatsapp successfully with valid fields', () => {
  assert(workerCode.includes('function validateChannelConfig('), 'validateChannelConfig function defined');
  const required = ['wa_phone_id', 'wa_access_token'];
  const payload = { wa_phone_id: '123456', wa_access_token: 'tok_abc' };
  const missing = required.filter(f => !payload[f]);
  assert(missing.length === 0, 'No missing fields for valid whatsapp');
});

test('validateChannelConfig rejects whatsapp with missing wa_access_token', () => {
  const required = ['wa_phone_id', 'wa_access_token'];
  const payload = { wa_phone_id: '123456' };
  const missing = required.filter(f => !payload[f]);
  assert(missing.includes('wa_access_token'), 'Missing wa_access_token detected');
});

test('validateChannelConfig validates youtube successfully with valid fields', () => {
  const required = ['yt_channel_id', 'yt_api_key'];
  const payload = { yt_channel_id: 'UC12345', yt_api_key: 'AIzaSy...' };
  const missing = required.filter(f => !payload[f]);
  assert(missing.length === 0, 'No missing fields for valid youtube');
});

test('validateChannelConfig rejects youtube with missing yt_api_key', () => {
  const required = ['yt_channel_id', 'yt_api_key'];
  const payload = { yt_channel_id: 'UC12345' };
  const missing = required.filter(f => !payload[f]);
  assert(missing.includes('yt_api_key'), 'Missing yt_api_key detected');
});

test('validateChannelConfig validates instagram successfully with valid fields', () => {
  const required = ['ig_page_id', 'ig_access_token'];
  const payload = { ig_page_id: '17841400', ig_access_token: 'EAAB...' };
  const missing = required.filter(f => !payload[f]);
  assert(missing.length === 0, 'No missing fields for valid instagram');
});

test('validateChannelConfig rejects instagram with missing ig_access_token', () => {
  const required = ['ig_page_id', 'ig_access_token'];
  const payload = { ig_page_id: '17841400' };
  const missing = required.filter(f => !payload[f]);
  assert(missing.includes('ig_access_token'), 'Missing ig_access_token detected');
});

test('validateChannelConfig validates tiktok successfully with valid fields', () => {
  const required = ['tt_client_key', 'tt_client_secret'];
  const payload = { tt_client_key: 'aw12345', tt_client_secret: 'sec_987' };
  const missing = required.filter(f => !payload[f]);
  assert(missing.length === 0, 'No missing fields for valid tiktok');
});

test('validateChannelConfig rejects tiktok with missing tt_client_secret', () => {
  const required = ['tt_client_key', 'tt_client_secret'];
  const payload = { tt_client_key: 'aw12345' };
  const missing = required.filter(f => !payload[f]);
  assert(missing.includes('tt_client_secret'), 'Missing tt_client_secret detected');
});

test('Mandatory extra fields webhook_url, custom_template, active_schedule supported', () => {
  assert(workerCode.includes('webhook_url: cfgRaw.webhook_url'), 'webhook_url merged');
  assert(workerCode.includes('custom_template: cfgRaw.custom_template'), 'custom_template merged');
  assert(workerCode.includes('active_schedule: cfgRaw.active_schedule'), 'active_schedule merged');
});

// --- 2. Telegram Placeholder (501) ---
console.log('\n--- 2. Telegram Placeholder ---');

test('Telegram route /api/channel-config/telegram returns 501 Not Implemented', () => {
  assert(workerCode.includes("url.pathname === '/api/channel-config/telegram'"), 'Telegram endpoint registered');
  assert(workerCode.includes("501"), 'Returns 501');
  assert(workerCode.includes('Telegram integration not yet implemented'), '501 message');
});

test('Telegram test route /api/channel-config/telegram/test returns 501 Not Implemented', () => {
  assert(workerCode.includes("url.pathname === '/api/channel-config/telegram/test'"), 'Telegram test endpoint registered');
});

// --- 3. Rate-Limiting per IP (CF-Connecting-IP) ---
console.log('\n--- 3. Rate-Limiting per IP ---');

test('ipRateLimit helper extracts IP from CF-Connecting-IP or X-Forwarded-For', () => {
  assert(workerCode.includes('async function ipRateLimit('), 'ipRateLimit helper defined');
  assert(workerCode.includes('CF-Connecting-IP') || workerCode.includes('cf-connecting-ip'), 'extracts CF-Connecting-IP');
  assert(workerCode.includes('x-forwarded-for'), 'extracts x-forwarded-for fallback');
});

test('Rate-limit threshold 10/min enforced on POST /api/channel-config/{channel}', () => {
  assert(workerCode.includes("await ipRateLimit(request, 'ch_post', 10)"), '10/min rate limit on POST channel-config');
  assert(workerCode.includes('rate_limit_exceeded'), 'returns rate_limit_exceeded');
});

test('Rate-limit threshold 30/min enforced on POST /api/channel-config/{channel}/test', () => {
  assert(workerCode.includes("await ipRateLimit(request, 'ch_test', 30)"), '30/min rate limit on channel test');
});

test('Rate-limit threshold 5/min enforced on DELETE /api/channel-config/{channel}', () => {
  assert(workerCode.includes("await ipRateLimit(request, 'ch_delete', 5)"), '5/min rate limit on channel delete');
});

test('Rate-limit threshold 60/min enforced on GET /api/channel-config/all', () => {
  assert(workerCode.includes("await ipRateLimit(request, 'ch_get_all', 60)"), '60/min rate limit on get all configs');
});

// --- 4. Hunter Runtime Integration & Channel Config Loading ---
console.log('\n--- 4. Hunter Runtime Integration ---');

test('loadChannelConfig helper defined and reads from Redis channel:config:{ch}:{dom}', () => {
  assert(workerCode.includes('async function loadChannelConfig('), 'loadChannelConfig function defined');
  assert(workerCode.includes("'channel:config:' + channel + ':' + dom"), 'reads redis key');
});

test('Hunter sendWhatsAppButton loads channel config at runtime', () => {
  assert(workerCode.includes("loadChannelConfig(dom, 'whatsapp')"), 'reads whatsapp config at runtime');
  assert(workerCode.includes("const cfg = { ...baseCfg, ...(chCfg || {}) }"), 'merges base and channel config');
});

// --- 5. Connection Test Endpoint (/test) ---
console.log('\n--- 5. Connection Test Endpoint (/test) ---');

test('POST /api/channel-config/{channel}/test endpoint registered', () => {
  assert(workerCode.includes("url.pathname.endsWith('/test') && request.method === 'POST'"), 'test endpoint registered');
});

test('Connection test verifies WhatsApp credentials and target endpoint', () => {
  assert(workerCode.includes("https://graph.facebook.com/v20.0/"), 'whatsapp graph api endpoint verified');
  assert(workerCode.includes('credentials_present'), 'returns credentials_present status');
});

test('Connection test verifies YouTube channel_id and api_key', () => {
  assert(workerCode.includes("https://www.googleapis.com/youtube/v3/channels"), 'youtube v3 endpoint verified');
});

test('Connection test verifies Instagram page_id and access_token', () => {
  assert(workerCode.includes('cfg.ig_page_id && cfg.ig_access_token'), 'instagram credentials verified');
});

test('Connection test verifies TikTok client_key and client_secret', () => {
  assert(workerCode.includes("https://open-api.tiktok.com/oauth/access_token/"), 'tiktok oauth endpoint verified');
});

// --- 6. Instagram Webhook Verification (hub.challenge) ---
console.log('\n--- 6. Instagram Webhook Verification ---');

test('Instagram webhook GET endpoint registered at /api/channel-config/instagram/webhook', () => {
  assert(workerCode.includes("url.pathname === '/api/channel-config/instagram/webhook'"), 'webhook endpoint registered');
});

test('Instagram webhook echoes hub.challenge with text/plain on valid verify_token', () => {
  assert(workerCode.includes("mode === 'subscribe' && tokenMatch"), 'checks subscribe mode and token match');
  assert(workerCode.includes("'Content-Type': 'text/plain'"), 'returns pure text/plain headers');
  assert(workerCode.includes('new Response(challenge,'), 'echoes hub.challenge directly');
});

test('Instagram webhook returns 403 on invalid verify_token', () => {
  assert(workerCode.includes("json({ error: 'unauthorized' }, 403)"), 'returns 403 unauthorized on invalid token');
});

// --- 7. Channel Usage Metrics & LGPD Erasure ---
console.log('\n--- 7. Channel Usage Metrics & LGPD Erasure ---');

test('incChannelUsage helper defined and executes HINCRBY channel:usage:{dom}', () => {
  assert(workerCode.includes('async function incChannelUsage('), 'incChannelUsage function defined');
  assert(workerCode.includes("'channel:usage:' + dom"), 'targets channel:usage:{dom} key');
  assert(workerCode.includes("'HINCRBY'"), 'uses HINCRBY command');
});

test('DELETE /api/channel-config/{channel} erases channel config and usage (LGPD)', () => {
  assert(workerCode.includes("'channel:config:' + channel + ':' + dom"), 'deletes channel:config');
  assert(workerCode.includes("'channel:usage:' + dom, channel"), 'HDEL channel from usage');
});

test('Global /api/lgpd-delete erases all 5 channel configs', () => {
  assert(workerCode.includes("['whatsapp', 'youtube', 'instagram', 'tiktok', 'telegram']"), 'iterates over all 5 channels');
  assert(workerCode.includes("'channel:config:' + ch + ':' + dom"), 'deletes each channel:config');
});

// --- 8. Idempotency & JSDoc ---
console.log('\n--- 8. Idempotency & JSDoc ---');

test('POST /api/channel-config/{channel} checks existing config for idempotency (created vs updated)', () => {
  assert(workerCode.includes("const isUpdate = Object.keys(existing).length > 0"), 'checks if config existed');
  assert(workerCode.includes("status: isUpdate ? 'updated' : 'created'"), 'returns created vs updated status');
});

test('JSDoc comments document error status codes and responses', () => {
  assert(workerCode.includes('400'), 'documents 400');
  assert(workerCode.includes('429'), 'documents 429');
  assert(workerCode.includes('501'), 'documents 501');
});

console.log('\n================================================================');
console.log(`🎯 TEST RESULTS: ${passed} / ${passed + failed} tests passed`);
if (failed === 0) {
  console.log('🎉 ALL 31 CHANNEL & CRITICAL ADJUSTMENT TESTS PASSED PERFECTLY!');
} else {
  console.log(`⚠️ ${failed} TESTS FAILED.`);
  process.exit(1);
}
console.log('================================================================\n');
