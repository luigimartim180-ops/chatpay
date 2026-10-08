/**
 * EGRESS TELEGRAM + TOKEN BUCKET (Fase 1 — scaffold, NÃO ativo)
 *
 * Limite global Telegram: ~30 mensagens/segundo por bot.
 * Shared bot com 1.000 clientes estoura se processar síncrono.
 *
 * Padrão:
 *   webhook → enqueue() → 200 OK Telegram
 *   worker  → dequeue() → processar → sendWithLimit()
 */

export const TELEGRAM_GLOBAL_MSG_PER_SEC = 25; // folga sob o limite 30/s
const NS_PER_SEC = 1e9;

/** Token bucket simples em memória (em produção: Redis INCR + EXPIRE ou Lua). */
export class TokenBucket {
  constructor(ratePerSec = TELEGRAM_GLOBAL_MSG_PER_SEC, capacity = ratePerSec * 2) {
    this.rate = ratePerSec;
    this.capacity = capacity;
    this.tokens = capacity;
    this.updatedAt = Date.now();
  }
  _refill() {
    const now = Date.now();
    const delta = (now - this.updatedAt) / 1000;
    this.updatedAt = now;
    this.tokens = Math.min(this.capacity, this.tokens + delta * this.rate);
  }
  tryRemove(n = 1) {
    this._refill();
    if (this.tokens >= n) {
      this.tokens -= n;
      return true;
    }
    return false;
  }
  waitMs(n = 1) {
    this._refill();
    if (this.tokens >= n) return 0;
    const need = n - this.tokens;
    return Math.ceil((need / this.rate) * 1000);
  }
}

const bucket = new TokenBucket();

/**
 * Envia mensagem respeitando rate limit global.
 * @param {string} botToken
 * @param {string|number} chatId
 * @param {string} text
 */
export async function sendWithLimit(botToken, chatId, text, fetchImpl = fetch) {
  const wait = bucket.waitMs(1);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  if (!bucket.tryRemove(1)) {
    await new Promise(r => setTimeout(r, Math.ceil(1000 / bucket.rate)));
    bucket.tryRemove(1);
  }
  const res = await fetchImpl(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: String(text || '').slice(0, 4000) })
  });
  return { ok: res.ok, status: res.status };
}

/** Prioridade: price > buy > general (menor = antes). */
export function priorityOf(intent) {
  if (intent === 'price_inquiry' || intent === 'potential_buy') return 0;
  if (intent === 'start_bound') return 1;
  return 2;
}

/**
 * Fila em Redis (ZSET por prioridade + timestamp).
 * Padrão de item: JSON { id, chatId, botToken, text, intent, domain, ts }
 *
 * PUSH:  ZADD queue:telegram {score} {json}
 *        score = priority * 1e13 + ts
 * POP:   ZPOPMIN queue:telegram
 */
export async function enqueue(redis, item) {
  const ts = Date.now();
  const score = priorityOf(item.intent) * 1e13 + ts;
  const payload = JSON.stringify({ ...item, ts, score });
  await redis('ZADD', 'queue:telegram', String(score), payload);
  return { queued: true, score };
}

export async function dequeue(redis) {
  const raw = (await redis('ZPOPMIN', 'queue:telegram')).result;
  if (!raw) return null;
  try {
    return JSON.parse(Array.isArray(raw) ? raw[0] : raw);
  } catch (_) {
    return null;
  }
}

export async function queueLength(redis) {
  return Number((await redis('ZCARD', 'queue:telegram')).result || 0);
}
