import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

class MiniRedis {
  constructor() {
    this.values = new Map();
    this.hashes = new Map();
    this.lists = new Map();
    this.sets = new Map();
    this.sorted = new Map();
    this.expiry = new Map();
  }

  _expire(key) {
    const at = this.expiry.get(key);
    if (at && at <= Date.now()) {
      this.values.delete(key);
      this.hashes.delete(key);
      this.lists.delete(key);
      this.sets.delete(key);
      this.sorted.delete(key);
      this.expiry.delete(key);
    }
  }

  _value(key) {
    this._expire(key);
    return this.values.get(key);
  }

  command(command, args) {
    const cmd = command.toUpperCase();
    const key = String(args[0] || '');
    if (cmd === 'GET') return { result: this._value(key) ?? null };
    if (cmd === 'SET') {
      const upper = args.map(a => String(a).toUpperCase());
      if (upper.includes('NX')) {
        this._expire(key);
        const present = this.values.has(key) || this.hashes.has(key) || this.lists.has(key) || this.sets.has(key) || this.sorted.has(key);
        if (present) return { result: null };
      }
       this.values.set(key, String(args[1] ?? ''));
      const exIdx = args.findIndex(a => String(a).toUpperCase() === 'EX');
      if (exIdx >= 0 && args[exIdx + 1] !== undefined) {
        this.expiry.set(key, Date.now() + Number(args[exIdx + 1]) * 1000);
      }
      return { result: 'OK' };
    }
    if (cmd === 'SETEX') {
      const ttl = Number(args[1]);
      this.values.set(String(args[0]), String(args[2] ?? ''));
      this.expiry.set(String(args[0]), Date.now() + ttl * 1000);
      return { result: 'OK' };
    }
    if (cmd === 'DEL') {
      let deleted = 0;
      for (const store of [this.values, this.hashes, this.lists, this.sets, this.sorted]) {
        if (store.delete(key)) deleted++;
      }
      this.expiry.delete(key);
      return { result: deleted };
    }
    if (cmd === 'EXPIRE') {
      this.expiry.set(key, Date.now() + Number(args[1]) * 1000);
      return { result: 1 };
    }
    if (cmd === 'INCR') {
      const value = Number(this._value(key) || 0) + 1;
      this.values.set(key, String(value));
      return { result: value };
    }
    if (cmd === 'HSET') {
      const hash = this.hashes.get(key) || new Map();
      let changed = 0;
      for (let i = 1; i < args.length; i += 2) {
        const field = String(args[i]);
        if (!hash.has(field)) changed++;
        hash.set(field, String(args[i + 1] ?? ''));
      }
      this.hashes.set(key, hash);
      return { result: changed };
    }
    if (cmd === 'HGET') return { result: (this.hashes.get(key) || new Map()).get(String(args[1])) ?? null };
    if (cmd === 'HGETALL') {
      const result = [];
      for (const [field, value] of this.hashes.get(key) || []) result.push(field, value);
      return { result };
    }
    if (cmd === 'HINCRBY') {
      const hash = this.hashes.get(key) || new Map();
      const field = String(args[1]);
      const value = Number(hash.get(field) || 0) + Number(args[2] || 0);
      hash.set(field, String(value));
      this.hashes.set(key, hash);
      return { result: value };
    }
    if (cmd === 'HINCRBYFLOAT') {
      const hash = this.hashes.get(key) || new Map();
      const field = String(args[1]);
      const value = Number(hash.get(field) || 0) + Number(args[2] || 0);
      hash.set(field, String(value));
      this.hashes.set(key, hash);
      return { result: value };
    }
    if (cmd === 'LPUSH') {
      const list = this.lists.get(key) || [];
      list.unshift(...args.slice(1).map(String));
      this.lists.set(key, list);
      return { result: list.length };
    }
    if (cmd === 'RPUSH') {
      const list = this.lists.get(key) || [];
      list.push(...args.slice(1).map(String));
      this.lists.set(key, list);
      return { result: list.length };
    }
    if (cmd === 'RPOP') {
      const list = this.lists.get(key) || [];
      return { result: list.length ? list.pop() : null };
    }
    if (cmd === 'LRANGE') {
      const list = this.lists.get(key) || [];
      const start = Number(args[1]);
      const end = Number(args[2]);
      return { result: list.slice(start < 0 ? list.length + start : start, end < 0 ? list.length + end + 1 : end + 1) };
    }
    if (cmd === 'LTRIM') {
      const list = this.lists.get(key) || [];
      const start = Number(args[1]);
      const end = Number(args[2]);
      this.lists.set(key, list.slice(start, end < 0 ? list.length + end + 1 : end + 1));
      return { result: 'OK' };
    }
    if (cmd === 'LLEN') return { result: (this.lists.get(key) || []).length };
    if (cmd === 'SADD') {
      const set = this.sets.get(key) || new Set();
      let added = 0;
      for (const value of args.slice(1).map(String)) {
        if (!set.has(value)) added++;
        set.add(value);
      }
      this.sets.set(key, set);
      return { result: added };
    }
    if (cmd === 'SREM') {
      const set = this.sets.get(key) || new Set();
      let removed = 0;
      for (const value of args.slice(1).map(String)) {
        if (set.delete(value)) removed++;
      }
      this.sets.set(key, set);
      return { result: removed };
    }
    if (cmd === 'SISMEMBER') return { result: (this.sets.get(key) || new Set()).has(String(args[1])) ? 1 : 0 };
    if (cmd === 'SMEMBERS') return { result: [...(this.sets.get(key) || new Set())] };
    if (cmd === 'ZADD') {
      const sorted = this.sorted.get(key) || new Map();
      sorted.set(String(args[2]), Number(args[1]));
      this.sorted.set(key, sorted);
      return { result: 1 };
    }
    if (cmd === 'ZRANGEBYSCORE') {
      const min = args[1] === '-inf' ? -Infinity : Number(args[1]);
      const max = args[2] === '+inf' ? Infinity : Number(args[2]);
      return { result: [...(this.sorted.get(key) || [])].filter(([, score]) => score >= min && score <= max).sort((a, b) => a[1] - b[1]).map(([value]) => value) };
    }
    if (cmd === 'ZREM') {
      const sorted = this.sorted.get(key) || new Map();
      const deleted = sorted.delete(String(args[1]));
      this.sorted.set(key, sorted);
      return { result: deleted ? 1 : 0 };
    }
    if (cmd === 'EXISTS') {
      this._expire(key);
      const present = this.values.has(key) || this.hashes.has(key) || this.lists.has(key) || this.sets.has(key) || this.sorted.has(key);
      return { result: present ? 1 : 0 };
    }
    if (cmd === 'ZCARD') {
      this._expire(key);
      return { result: (this.sorted.get(key) || new Map()).size };
    }
    if (cmd === 'ZPOPMIN') {
      this._expire(key);
      const sorted = this.sorted.get(key) || new Map();
      if (!sorted.size) return { result: null };
      let minKey = null;
      let minScore = Infinity;
      for (const [member, score] of sorted) {
        if (score < minScore) { minScore = score; minKey = member; }
      }
      sorted.delete(minKey);
      this.sorted.set(key, sorted);
      return { result: [minKey, String(minScore)] };
    }
    throw new Error(`MiniRedis command not implemented: ${command}`);
  }
}

const redisStore = new MiniRedis();
const realFetch = globalThis.fetch;
const faults = { redisDelayMs: 0, llmStatus: 0, webhookFailures: 0, webhookAttempts: 0, webhookTimes: [], llmCalls: 0, llmCostR$: 0, llmUnavailable: true, telegramSends: 0, lastTelegramBody: null, callbackAnswers: 0, lastCallbackId: null, llmQueue: [], lastPrompt: '', chatActions: 0, getFileCalls: 0, vecUpserts: [], aiRunner: null, getFilePath: null, deepseekResponse: null, graphCalls: [] };
const testEnv = {
  // AI opt-in: null por padrão (igual antes); só expõe {run} quando um teste define faults.aiRunner
  get AI() { return typeof faults.aiRunner === 'function' ? { run: (model, input) => faults.aiRunner(model, input) } : null; },
  VECTORIZE: {
    async upsert(vectors) { faults.vecUpserts.push(vectors); return { count: vectors.length }; },
    async query() { return { matches: [] }; }
  },
  REDIS_URL: 'https://current-pheasant-114427.upstash.io',
  REDIS_TOKEN: 'test-redis-token',
  RESEND_KEY: 'test-resend-key',
  TARGET_EMAIL: 'test@example.com',
  MIDAS_SECRET: 'test-midas-secret',
  JWT_SECRET: 'test-jwt-secret'
};
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function stubFetch(input, init = {}) {
  const url = String(input);
  if (url.startsWith('https://current-pheasant-114427.upstash.io/')) {
    if (faults.redisDelayMs) await wait(faults.redisDelayMs);
    const path = new URL(url).pathname.split('/').slice(1).map(decodeURIComponent);
    const result = redisStore.command(path[0], path.slice(1));
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.includes('graph.facebook.com') || url.includes('api.clicksign') || url.includes('open-api.tiktok')) {
    try { faults.graphCalls.push({ url, body: init.body ? JSON.parse(init.body) : null }); } catch (_) { }
    return new Response(JSON.stringify({ ok: true, id: 'mock-id', data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.startsWith('https://api.resend.com/')) return new Response(JSON.stringify({ id: 'mock-email' }), { status: 200 });
  if (url.startsWith('https://api.mercadopago.com/')) return new Response(JSON.stringify({}), { status: 200 });
  if (url.startsWith('https://api.deepseek.com/') || url.startsWith('https://api.openai.com/')) {
    faults.llmCalls += 1;
    let body = {};
    try { body = init.body ? JSON.parse(init.body) : {}; } catch (_) { }
    const promptText = Array.isArray(body.messages) ? body.messages.map(m => m.content).join(' ') : '';
    faults.lastPrompt = promptText;
    if (faults.llmStatus) return new Response('llm unavailable', { status: faults.llmStatus });
    faults.llmUnavailable = false;
    const mockReply = faults.deepseekResponse || JSON.stringify({
      bant: { budget: 8, authority: 6, need: 9, timing: 7 },
      meddic: { metrics: 7, economicBuyer: 5, decisionCriteria: 6, decisionProcess: 5, identifyPain: 8, champion: 7 },
      spin: { situation: 6, problem: 8, implication: 7, needPayoff: 8 },
      methodology: 'MEDDIC',
      reasoning: 'Compra imediata com poderio de decisão'
    });
    return new Response(JSON.stringify({ choices: [{ message: { content: mockReply } }], usage: { total_tokens: 150, prompt_tokens: 80, completion_tokens: 70 } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (url.startsWith('https://text.pollinations.ai/')) {
    faults.llmCalls += 1;
    let tokenEstimate = 1;
    try {
      const body = init.body ? JSON.parse(init.body) : {};
      tokenEstimate = Math.max(1, Math.ceil(String(body.prompt || body.inputs || '').length / 4));
    } catch (_) { }
    faults.llmCostR$ += tokenEstimate * 0.00002;
    try {
      faults.lastPrompt = decodeURIComponent(String(url).slice('https://text.pollinations.ai/'.length)) || String(init.body || '');
    } catch (_) { faults.lastPrompt = String(url); }
    if (Array.isArray(faults.llmQueue) && faults.llmQueue.length) {
      return new Response(String(faults.llmQueue.shift()), { status: 200 });
    }
    if (faults.llmStatus) return new Response('llm unavailable', { status: faults.llmStatus });
    faults.llmUnavailable = false;
    return new Response('', { status: 200 });
  }
  if (url.startsWith('https://api.telegram.org/')) {
    faults.telegramSends = (faults.telegramSends || 0) + (url.includes('/sendMessage') ? 1 : 0);
    if (url.includes('/sendMessage')) {
      try { faults.lastTelegramBody = JSON.parse(init.body || '{}'); } catch (_) { faults.lastTelegramBody = null; }
    }
    if (url.includes('/answerCallbackQuery')) {
      faults.callbackAnswers = (faults.callbackAnswers || 0) + 1;
      faults.lastCallbackId = null;
      try { faults.lastCallbackId = JSON.parse(init.body || '{}').callback_query_id || null; } catch (_) { }
    }
    if (url.includes('/sendChatAction')) faults.chatActions = (faults.chatActions || 0) + 1;
    if (url.includes('/getFile')) faults.getFileCalls = (faults.getFileCalls || 0) + 1;
    if (url.includes('/getMe')) return new Response(JSON.stringify({ ok: true, result: { id: 123456, is_bot: true, username: 'ChatPayMasterBot', first_name: 'Master' } }), { status: 200 });
    if (url.includes('/setWebhook')) return new Response(JSON.stringify({ ok: true, result: true }), { status: 200 });
    if (url.includes('/sendMessage')) return new Response(JSON.stringify({ ok: true, result: { message_id: 1, chat: { id: 1 }, text: 'ok' } }), { status: 200 });
    if (url.includes('/getFile')) return new Response(JSON.stringify({ ok: true, result: faults.getFilePath ? { file_path: faults.getFilePath } : {} }), { status: 200 });
    return new Response(JSON.stringify({ ok: true, result: {} }), { status: 200 });
  }
  if (url.startsWith('https://api.qrserver.com/')) return new Response('qr-bytes', { status: 200 });
  if (url.startsWith('https://harness.webhook/')) {
    faults.webhookAttempts += 1;
    faults.webhookTimes.push(Date.now());
    return new Response('{}', { status: faults.webhookAttempts <= faults.webhookFailures ? 503 : 200 });
  }
  throw new Error(`Unexpected external fetch in harness: ${url}`);
}

const source = fs.readFileSync(new URL('../worker.js', import.meta.url), 'utf8').replace('export default', '__W__ =');
const sandbox = {
  __W__: null,
  fetch: stubFetch,
  crypto: crypto.webcrypto,
  btoa: value => Buffer.from(value, 'binary').toString('base64'),
  atob: value => Buffer.from(value, 'base64').toString('binary'),
  TextEncoder,
  TextDecoder,
  URL,
  URLSearchParams,
  Request,
  Response,
  Headers,
  Date,
  console,
  setTimeout,
  clearTimeout,
  AbortController,
  Math,
  JSON,
  String,
  Number,
  parseInt,
  parseFloat,
  encodeURIComponent,
  decodeURIComponent
};
vm.createContext(sandbox);
vm.runInContext(source, sandbox, { filename: 'worker.js' });

export const worker = sandbox.__W__;
export const makeRequest = async (method, path, body, headers = {}) => {
  const request = new Request(`https://harness.local${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const pending = [];
  const ctx = {
    waitUntil(p) {
      pending.push(Promise.resolve(p).catch(() => {}));
    }
  };
  const response = await worker.fetch(request, testEnv, ctx);
  await Promise.all(pending);
  return response;
};
export const seedRedis = (key, value) => redisStore.command('SET', [key, typeof value === 'string' ? value : JSON.stringify(value)]);
export const redisCommand = (command, ...args) => redisStore.command(command, args);
export const configureHarness = values => {
  Object.assign(faults, values);
  if (values.webhookAttempts === undefined) faults.webhookAttempts = 0;
  if (values.webhookTimes === undefined) faults.webhookTimes = [];
};
export const harnessFaults = faults;
export const redisTtl = key => {
  redisStore._expire(key);
  const at = redisStore.expiry.get(key);
  return at ? Math.max(0, Math.round((at - Date.now()) / 1000)) : -1;
};
export const dumpRedis = prefix => ({
  values: [...redisStore.values].filter(([key]) => key.startsWith(prefix)),
  hashes: [...redisStore.hashes].filter(([key]) => key.startsWith(prefix)),
  lists: [...redisStore.lists].filter(([key]) => key.startsWith(prefix)),
  sorted: [...redisStore.sorted].filter(([key]) => key.startsWith(prefix))
});
export const agentRuns = async dom => {
  const result = redisStore.command('HGETALL', [`agent:runs:${dom}`]).result;
  return Object.fromEntries(Array.from({ length: result.length / 2 }, (_, index) => [result[index * 2], Number(result[index * 2 + 1])]));
};
export const runScheduled = async () => worker.scheduled?.({ cron: '* * * * *' }, testEnv, {}) || null;

if (process.argv[1] && process.argv[1].endsWith('harness.js')) {
  const response = await makeRequest('GET', '/');
  assert.equal(response.status, 200);
  console.log('harness loaded worker successfully');
}
