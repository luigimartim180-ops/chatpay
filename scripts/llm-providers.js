import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadLabSecrets } from './secret-loader.js';

export const DEFAULT_OPENROUTER_MODEL = 'nvidia/nemotron-3.5-lightning:free';
export const PROVIDER_ORDER = ['cerebras', 'groq', 'mistral', 'deepseek', 'openrouter', 'gemini', 'github_models'];
export const REAL_PROVIDERS = ['cerebras', 'groq', 'mistral', 'deepseek', 'openrouter', 'gemini', 'github_models'];
export const GEMINI_DEFAULT_MODEL = 'gemini-flash-latest';
export const REAL_CACHE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'simulator', 'cache-real.json');

const DEEPSEEK_BASE = 'https://api.deepseek.com/v1';
const DEEPSEEK_COST_USD = { chat: { in: 0.14, out: 0.28 }, reasoner: { in: 0.55, out: 2.19 } };
const DEEPSEEK_USD_BRL = 5.5;
export const DEEPSEEK_CONFIG = {
  chat: { model: 'deepseek-chat', baseURL: DEEPSEEK_BASE, costIn: 0.14, costOut: 0.28 },
  reasoner: { model: 'deepseek-reasoner', baseURL: DEEPSEEK_BASE, costIn: 0.55, costOut: 2.19 }
};
const DEFAULT_CACHE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'simulator', 'cache.json');
export const RUN_LOG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'simulator', 'run-log.json');

const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const estimateTokens = text => Math.max(1, Math.ceil(String(text || '').length / 4));
const providerError = (name, response) => {
  const quota = response.headers?.get?.('x-ratelimit-remaining') || response.headers?.get?.('x-ratelimit-remaining-requests');
  return new Error(`${name} HTTP ${response.status}${quota ? ` quota_remaining=${quota}` : ''}`);
};

const DEFAULT_TIMEOUT_MS = 30000;
async function fetchWithTimeout(fetchImpl, url, options, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`timeout após ${timeoutMs}ms`);
    }
    throw error;
  }
}

export async function probeProviders({ fetchImpl = globalThis.fetch, env = loadLabSecrets(), timeoutMs = 15000, onEvent = null } = {}) {
  const chain = createProviderChain({ env, fetchImpl });
  const endpoints = {
    cerebras: ['https://api.cerebras.ai/v1/chat/completions', env.CEREBRAS_API_KEY, { model: env.CEREBRAS_MODEL || 'gpt-oss-120b', max_tokens: 1 }],
    groq: ['https://api.groq.com/openai/v1/chat/completions', env.GROQ_API_KEY, { model: env.GROQ_MODEL || 'openai/gpt-oss-20b', max_tokens: 1 }],
    deepseek: [`${DEEPSEEK_BASE}/chat/completions`, env.DEEPSEEK_API_KEY, { model: env.DEEPSEEK_MODEL || 'deepseek-chat', max_tokens: 1 }],
    openrouter: ['https://openrouter.ai/api/v1/chat/completions', env.OPENROUTER_API_KEY, { model: env.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL, max_tokens: 1 }],
    mistral: ['https://api.mistral.ai/v1/chat/completions', env.MISTRAL_API_KEY, { model: env.MISTRAL_MODEL || 'mistral-small-latest', max_tokens: 1 }],
    gemini: [`https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY || '')}`, env.GEMINI_API_KEY, { contents: [{ parts: [{ text: 'ping' }] }] }],
    github_models: ['https://models.inference.ai.azure.com/chat/completions', env.GITHUB_MODELS_TOKEN || env.GITHUB_TOKEN, { model: env.GITHUB_MODEL || 'gpt-4o-mini', max_tokens: 1 }]
  };
  const results = {};
  for (const name of PROVIDER_ORDER) {
    const [endpoint, key, body] = endpoints[name];
    if (!key) { results[name] = 'ausente'; onEvent?.({ type: 'probe', provider: name, status: 'ausente' }); continue; }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const headers = name === 'gemini' ? { 'Content-Type': 'application/json' } : { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
    try {
      const response = await fetchImpl(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
      const status = response.status;
      const isInferenceOk = status === 200 || status === 429;
      results[name] = isInferenceOk ? status : status;
      onEvent?.({ type: 'probe', provider: name, status });
    } catch (error) {
      results[name] = 'erro';
      onEvent?.({ type: 'probe', provider: name, status: 'erro' });
    } finally { clearTimeout(timer); }
  }
  return results;
}

export function sortProviderOrderByProbe(probeResults, baseOrder = PROVIDER_ORDER) {
  const score = status => {
    if (status === 200) return 0;
    if (status === 429) return 1;
    if (status === 'ausente' || status === 'erro') return 3;
    return 2;
  };
  return [...baseOrder].sort((a, b) => (score(probeResults[a] ?? 'erro')) - (score(probeResults[b] ?? 'erro')));
}

export function cacheKey(seed, persona, turn, prompt) {
  const promptHash = sha256(prompt);
  return sha256(`${seed}${persona}${turn}${promptHash}`);
}

export function readCache(cacheFile = DEFAULT_CACHE) {
  try {
    const value = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    return value && typeof value === 'object' ? value : {};
  } catch (_) {
    return {};
  }
}

export function writeCache(cache, cacheFile = DEFAULT_CACHE) {
  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, `${JSON.stringify(cache, null, 2)}\n`);
}

function telemetry(provider, usage, cost, unavailable = false, cacheHit = false) {
  const tokens = Number(usage?.total_tokens || usage?.totalTokens || usage?.tokens || 0);
  return {
    provider, calls: cacheHit ? 0 : 1, tokens, cost_r$: cacheHit ? 0 : Number(cost || 0),
    unavailable: Boolean(unavailable), cache_hit: cacheHit
  };
}

export function createProviderChain({ fetchImpl = globalThis.fetch, ai = null, env = loadLabSecrets(), localOnly = true, model } = {}) {
  const key = env?.OPENROUTER_API_KEY;
  const geminiKey = env?.GEMINI_API_KEY;
  const groqKey = env?.GROQ_API_KEY;
  const githubKey = env?.GITHUB_MODELS_TOKEN || env?.GITHUB_TOKEN;
  const cerebrasKey = env?.CEREBRAS_API_KEY;
  const deepseekKey = env?.DEEPSEEK_API_KEY;
  const openRouterModel = model || env?.OPENROUTER_MODEL || DEFAULT_OPENROUTER_MODEL;
  const deepseekChatModel = env?.DEEPSEEK_MODEL || 'deepseek-chat';
  const deepseekReasonerModel = env?.DEEPSEEK_MODEL_REASONER || 'deepseek-reasoner';
  const estimateDeepSeekCostBrl = (usage, variant) => {
    const total = Number(usage?.total_tokens || usage?.totalTokens || 0);
    const prompt = Number(usage?.prompt_tokens || usage?.promptTokens || 0);
    const completion = Number(usage?.completion_tokens || usage?.completionTokens || 0);
    const rate = DEEPSEEK_COST_USD[variant];
    if (!rate || total === 0) return 0;
    const outTokens = prompt + completion === total ? completion : Math.max(0, total - prompt);
    const inTokens = Math.min(total, prompt || 0);
    return Number((((inTokens * (rate.in || 0) + outTokens * (rate.out || 0)) / 1000000) * DEEPSEEK_USD_BRL).toFixed(6));
  };
  const groqMutex = { busy: false, queue: [] };
  const jitterMs = () => 300 + Math.floor(Math.random() * 500);
  const groqRetryAfter = async response => {
    const header = response.headers?.get?.('retry-after') || response.headers?.get?.('x-ratelimit-reset');
    const ms = header ? (Number.isFinite(Number(header)) ? Number(header) * 1000 : Number(header)) : 0;
    return Number.isFinite(ms) && ms > 0 ? ms : jitterMs();
  };
  const deepseekRequest = async (name, selectedModel, variant, prompt) => {
    if (!localOnly || !deepseekKey) return { ...telemetry(name, {}, 0, true), skipped: true, reason: 'DEEPSEEK_API_KEY ausente ou execução não-local' };
    const response = await fetchWithTimeout(fetchImpl, `${DEEPSEEK_BASE}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${deepseekKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel, messages: [{ role: 'user', content: prompt }], max_tokens: 800 })
    });
    if (!response.ok) throw providerError(name, response);
    const data = await response.json();
    const usage = data.usage || {};
    const reply = data.choices?.[0]?.message?.content || '';
    const cost = estimateDeepSeekCostBrl(usage, variant);
    return { reply, ...telemetry(name, usage, cost), model: selectedModel, usage };
  };
  const requestOpenAICompatible = async (name, endpoint, key, selectedModel, prompt) => {
    if (!localOnly || !key) return { ...telemetry(name, {}, 0, true), skipped: true, reason: `${name} key ausente` };
    const response = await fetchWithTimeout(fetchImpl, endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: selectedModel, messages: [{ role: 'user', content: prompt }], max_tokens: 800 }) });
    if (!response.ok) throw providerError(name, response);
    const data = await response.json();
    const usage = data.usage || {};
    return { reply: data.choices?.[0]?.message?.content || '', ...telemetry(name, usage, 0), usage, model: selectedModel };
  };
  const mistralKey = env?.MISTRAL_API_KEY;
  const mistralModel = env?.MISTRAL_MODEL || 'mistral-small-latest';
  return {
    async openrouter(prompt) {
      if (!localOnly || !key) return { ...telemetry('openrouter', {}, 0, true), skipped: true, reason: 'OPENROUTER_API_KEY ausente ou execução não-local' };
      const response = await fetchWithTimeout(fetchImpl, 'https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: openRouterModel, messages: [{ role: 'user', content: prompt }], max_tokens: 800 })
      });
      if (!response.ok) throw providerError('OpenRouter', response);
      const data = await response.json();
      const usage = data.usage || {};
      const reply = data.choices?.[0]?.message?.content || '';
      return { reply, ...telemetry('openrouter', usage, 0), model: openRouterModel, usage };
    },
    async mistral(prompt) {
      if (!localOnly || !mistralKey) return { ...telemetry('mistral', {}, 0, true), skipped: true, reason: 'MISTRAL_API_KEY ausente ou execução não-local' };
      const response = await fetchWithTimeout(fetchImpl, 'https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${mistralKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: mistralModel, messages: [{ role: 'user', content: prompt }], max_tokens: 800 })
      });
      if (!response.ok) throw providerError('Mistral', response);
      const data = await response.json();
      const usage = data.usage || {};
      const reply = data.choices?.[0]?.message?.content || '';
      return { reply, ...telemetry('mistral', usage, 0), model: mistralModel, usage };
    },
    async gemini(prompt) {
      if (!localOnly || !geminiKey) return { ...telemetry('gemini', {}, 0, true), skipped: true, reason: 'GEMINI_API_KEY ausente ou execução não-local' };
      const response = await fetchWithTimeout(fetchImpl, `https://generativelanguage.googleapis.com/v1beta/models/${env?.GEMINI_MODEL || GEMINI_DEFAULT_MODEL}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      if (!response.ok) throw providerError('Gemini', response);
      const data = await response.json();
      const usage = data.usageMetadata || {};
      const tokens = Number(usage.totalTokenCount || usage.promptTokenCount || 0);
      const reply = data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('') || '';
      return { reply, ...telemetry('gemini', { total_tokens: tokens || estimateTokens(reply) }, 0), usage };
    },
    async groq(prompt) {
      if (!localOnly || !groqKey) return { ...telemetry('groq', {}, 0, true), skipped: true, reason: 'GROQ_API_KEY ausente ou execução não-local' };
      const delay = await new Promise(resolve => {
        if (!groqMutex.busy) { groqMutex.busy = true; resolve(0); return; }
        groqMutex.queue.push(resolve);
      });
      try {
        if (delay > 0) await new Promise(r => setTimeout(r, delay));
        const startedAt = Date.now();
        const response = await fetchWithTimeout(fetchImpl, 'https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: env?.GROQ_MODEL || 'openai/gpt-oss-20b', messages: [{ role: 'user', content: prompt }], max_tokens: 800 })
        });
        const ms = Date.now() - startedAt;
        if (response.status === 429) {
          const retryMs = await groqRetryAfter(response);
          await new Promise(resolve => setTimeout(resolve, retryMs));
          const retryResp = await fetchWithTimeout(fetchImpl, 'https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: env?.GROQ_MODEL || 'openai/gpt-oss-20b', messages: [{ role: 'user', content: prompt }], max_tokens: 800 })
          });
          if (!retryResp.ok) throw providerError('Groq', retryResp);
          const data = await retryResp.json();
          const usage = data.usage || {};
          const reply = data.choices?.[0]?.message?.content || '';
          return { reply, ...telemetry('groq', usage, 0), usage, ms: Date.now() - startedAt };
        }
        if (!response.ok) throw providerError('Groq', response);
        const data = await response.json();
        const usage = data.usage || {};
        const reply = data.choices?.[0]?.message?.content || '';
        return { reply, ...telemetry('groq', usage, 0), usage, ms };
      } finally {
        groqMutex.busy = false;
        const next = groqMutex.queue.shift();
        if (next) setTimeout(() => next(jitterMs()), 0);
        else if (!groqMutex.queue.length) groqMutex.busy = false;
      }
    },
    async github_models(prompt) { return requestOpenAICompatible('github_models', 'https://models.inference.ai.azure.com/chat/completions', githubKey, env?.GITHUB_MODEL || 'gpt-4o-mini', prompt); },
    async cerebras(prompt) { return requestOpenAICompatible('cerebras', 'https://api.cerebras.ai/v1/chat/completions', cerebrasKey, env?.CEREBRAS_MODEL || 'gpt-oss-120b', prompt); },
    async deepseek(prompt) { return deepseekRequest('deepseek', deepseekChatModel, 'chat', prompt); },
    async deepseek_reasoner(prompt) { return deepseekRequest('deepseek_reasoner', deepseekReasonerModel, 'reasoner', prompt); },
    async workers_ai(prompt) {
      if (!ai?.run) return { ...telemetry('workers_ai', {}, 0, true), skipped: true, reason: 'Workers AI indisponível' };
      const data = await ai.run(env?.WORKERS_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct', { prompt, max_tokens: 800 });
      const reply = data?.response || data?.result?.response || '';
      const tokens = data?.usage?.total_tokens || estimateTokens(reply);
      return { reply, ...telemetry('workers_ai', { total_tokens: tokens }, 0), usage: data?.usage || { total_tokens: tokens } };
    },
    async pollinations(prompt) {
      const response = await fetchWithTimeout(fetchImpl, `https://text.pollinations.ai/${encodeURIComponent(prompt)}`);
      if (!response.ok) throw new Error(`Pollinations HTTP ${response.status}`);
      const reply = await response.text();
      const tokens = estimateTokens(reply || prompt);
      return { reply, ...telemetry('pollinations', { total_tokens: tokens }, tokens * 0.00002), usage: { total_tokens: tokens } };
    },
    async mock(prompt) {
      const reply = `Mock indisponível: ${String(prompt).slice(0, 120)}`;
      return { reply, ...telemetry('mock', { total_tokens: estimateTokens(reply) }, 0), usage: { total_tokens: estimateTokens(reply) } };
    }
  };
}

export async function generateWithProviders(prompt, {
  seed = 20260909, persona = '', turn = 0, provider = 'auto', cacheFile = DEFAULT_CACHE,
  chain = createProviderChain(), useCache = true, requireReal = false, retryDelaysMs = [5000, 30000, 120000], onEvent = null, providerOrder = PROVIDER_ORDER, forceProvider = false
} = {}) {
  const cache = useCache ? readCache(cacheFile) : {};
  const key = cacheKey(seed, persona, turn, prompt);
  if (useCache && cache[key] && (!requireReal || REAL_PROVIDERS.includes(cache[key].provider)) && (!forceProvider || cache[key].provider === provider)) {
    const cached = cache[key];
    onEvent?.({ type: 'call', seed, persona, turn: turn + 1, provider: cached.provider, status: 200, ms: 0, tokens: Number(cached.tokens || cached.usage?.total_tokens || 0), cache_hit: true });
    return { ...cached, ...telemetry(cached.provider, cached.usage, 0, cached.unavailable, true), cache_key: key };
  }
  const requested = provider === 'auto' ? providerOrder : (forceProvider ? [provider] : [provider, ...providerOrder.filter(item => item !== provider), 'workers_ai', 'pollinations', 'mock']);
  const errors = [];
  for (const name of requested) {
    if (requireReal && !REAL_PROVIDERS.includes(name)) continue;
    if (!chain[name]) continue;
    try {
      let result;
      for (let attempt = 0; ; attempt += 1) {
        const startedAt = Date.now();
        try {
          result = await chain[name](prompt);
          onEvent?.({ type: 'call', seed, persona, turn: turn + 1, provider: name, status: result?.skipped ? 'ausente' : 200, ms: Date.now() - startedAt, tokens: Number(result.tokens || result.usage?.total_tokens || 0), cache_hit: false });
          break;
        } catch (error) {
          const statusMatch = String(error.message || '').match(/HTTP (\d{3})/i);
          const status = statusMatch ? Number(statusMatch[1]) : 0;
          const isRateLimited = /HTTP 429\b/.test(error.message || '');
          if (!isRateLimited || attempt >= retryDelaysMs.length) {
            onEvent?.({ type: 'call', seed, persona, turn: turn + 1, provider: name, status, ms: Date.now() - startedAt, tokens: 0, cache_hit: false });
            throw error;
          }
          const delayMs = Number(retryDelaysMs[attempt]);
          onEvent?.({ type: 'retry', seed, persona, turn: turn + 1, provider: name, status, backoff_s: delayMs / 1000 });
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      if (result?.skipped) continue;
      const output = { ...result, cache_key: key, fallback_errors: errors, ts: new Date().toISOString(), tokens: Number(result.tokens || result.usage?.total_tokens || 0) };
      if (useCache) { cache[key] = output; writeCache(cache, cacheFile); }
      return output;
    } catch (error) {
      errors.push({ provider: name, error: error.message });
    }
  }
  if (requireReal && errors.length > 0) {
    const failed = { reply: '', provider: providerOrder[0] || 'mock', failed: true, fallback_errors: errors, cache_key: key, ts: new Date().toISOString(), tokens: 0, calls: 0, cost_r$: 0, cache_hit: false, unavailable: true };
    if (useCache) { cache[key] = failed; writeCache(cache, cacheFile); }
    return failed;
  }
  const result = await chain.mock(prompt);
  const output = { ...result, cache_key: key, fallback_errors: errors };
  if (useCache) { cache[key] = output; writeCache(cache, cacheFile); }
  return output;
}

export const SIM_AGENT_PERSONA = [
  'PAPEL: vocÃª Ã© o vendedor da ChatPay atendendo clientes no Telegram. Responda SOMENTE como esse vendedor, nunca como IA/assistente/ChatGPT.',
  'FATOS REAIS do produto: ChatPay Trial 30d por R$ 97,00; pagamento Pix ou cartÃ£o em atÃ© 12x; garantia de 7 dias; atendimento humano disponÃ­vel.',
  'Link de pagamento oficial: https://midas-core.novoronaldo-m.workers.dev/pay?d=chatpay.oficial',
  'REGRAS: PT-BR; no mÃ¡ximo 2 frases; sem markdown; nunca invente preÃ§o, desconto ou status de pagamento; nunca diga "pagamento confirmado"; se nÃ£o souber, ofereÃ§a falar com a equipe.',
  'Mensagem do cliente:'
].join('\n');

export function buildSimAgentPrompt(leadMessage) {
  return `${SIM_AGENT_PERSONA} ${String(leadMessage || '').trim()}`;
}

export async function runProviderSimulation({ personas, provider = 'mock', seed = 20260909, maxTurns = 5, personasSubset = 6, cacheFile = DEFAULT_CACHE, chain, useCache = true, requireReal = false, retryDelaysMs, onEvent, providerOrder = PROVIDER_ORDER, forceProvider = false } = {}) {
  const selected = (personas || []).slice(0, Number(personasSubset) || 6);
  const telemetryTotals = { calls: 0, tokens: 0, cost_r$: 0, cache_hits: 0, unavailable: false, providers: {} };
  const scenarios = [];
  let failedTurns = 0;
  let totalTurns = 0;
  for (let p = 0; p < selected.length; p += 1) {
    const persona = selected[p];
    const turns = [];
    for (let t = 0; t < Math.min(Number(maxTurns) || 5, persona.messages.length); t += 1) {
      totalTurns += 1;
      const agentPrompt = buildSimAgentPrompt(persona.messages[t]);
      const result = await generateWithProviders(agentPrompt, { seed: Number(seed) + p, persona: persona.id, turn: t, provider, cacheFile, chain, useCache, requireReal, retryDelaysMs, onEvent, providerOrder, forceProvider });
      const isFailed = Boolean(result.failed);
      if (isFailed) failedTurns += 1;
      turns.push({ turn: t + 1, prompt: persona.messages[t], reply: result.reply || '', provider: result.provider, usage: result.usage, cache_hit: result.cache_hit, failed: isFailed, fallback_errors: result.fallback_errors });
      telemetryTotals.calls += result.calls || 0;
      telemetryTotals.tokens += result.tokens || 0;
      telemetryTotals.cost_r$ += result.cost_r$ || 0;
      telemetryTotals.cache_hits += result.cache_hit ? 1 : 0;
      telemetryTotals.unavailable ||= Boolean(result.unavailable);
      telemetryTotals.providers[result.provider] = (telemetryTotals.providers[result.provider] || 0) + (result.calls || 0);
      if (t < Math.min(Number(maxTurns) || 5, persona.messages.length) - 1) {
        const jitter = 300 + Math.floor(Math.random() * 500);
        await new Promise(resolve => setTimeout(resolve, jitter));
      }
    }
    scenarios.push({ persona_id: persona.id, turns });
  }
  telemetryTotals.cost_r$ = Number(telemetryTotals.cost_r$.toFixed(6));
  const failureRate = totalTurns > 0 ? failedTurns / totalTurns : 0;
  const roundFailed = requireReal && failureRate > 0.3;
  return { phase: 'G', seed: Number(seed), provider, personas_run: selected.length, max_turns: Number(maxTurns) || 5, scenarios, llm_telemetry: telemetryTotals, round_failed: roundFailed, failure_rate: Number(failureRate.toFixed(2)), failed_turns: failedTurns, total_turns: totalTurns };
}
