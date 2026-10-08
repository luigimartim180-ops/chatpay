/**
 * SHARED BOT + DEEP LINKING (Fase 1 — scaffold, NÃO ativo no worker)
 *
 * Fluxo:
 *   t.me/MasterBot?start=loja_joao
 *     → Telegram entrega "/start loja_joao"
 *     → resolveDomainFromStart() valida e retorna domain
 *     → bindSession(chatId, domain) grava Redis session:{chatId} → domain (TTL 90d)
 *   Mensagens seguintes → resolveDomainFromChat(chatId)
 *
 * Redis:
 *   SET session:{chatId} {domain} EX 7776000
 *   GET session:{chatId}
 *   EXPIRE session:{chatId} 7776000  (renova a cada msg)
 *
 * Validações:
 *   domain: /^[a-z0-9._-]{2,60}$/
 *   rate limit /start: 5/min por chatId
 *   existe playbook/meta do domínio antes de bind
 */

export const SESSION_TTL_SECONDS = 7776000; // 90 dias
export const START_RATE_LIMIT = 5;
export const DOMAIN_RE = /^[a-z0-9._-]{2,60}$/;

/** Extrai domain do argumento de /start (deep link). */
export function parseStartPayload(text) {
  const m = String(text || '').match(/^\/start(?:@\w+)?(?:\s+(\S+))?/i);
  if (!m || !m[1]) return null;
  const raw = m[1].trim().toLowerCase();
  try {
    return decodeURIComponent(raw);
  } catch (_) {
    return raw;
  }
}

export function isValidDomain(domain) {
  return DOMAIN_RE.test(String(domain || ''));
}

/**
 * Gera deep link do master bot.
 * @param {string} botUsername ex: "ChatPayMasterBot"
 * @param {string} domain
 */
export function generateDeepLink(botUsername, domain) {
  const safe = encodeURIComponent(String(domain || '').toLowerCase());
  return `https://t.me/${botUsername}?start=${safe}`;
}

export function generateQRLink(botUsername, domain) {
  const link = generateDeepLink(botUsername, domain);
  return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;
}

/**
 * Bind chat_id → domain no Redis.
 * @param {(cmd:string,...args:any[])=>Promise<{result:any}>} redis
 * @param {string|number} chatId
 * @param {string} domain
 */
export async function bindSession(redis, chatId, domain) {
  if (!isValidDomain(domain)) throw new Error('invalid_domain');
  await redis('SET', 'session:' + String(chatId), domain, 'EX', String(SESSION_TTL_SECONDS));
  return { chatId: String(chatId), domain, ttl: SESSION_TTL_SECONDS };
}

/**
 * Resolve domain do chat; renova TTL se existir.
 * @returns {Promise<string|null>}
 */
export async function resolveDomainFromChat(redis, chatId) {
  const raw = (await redis('GET', 'session:' + String(chatId))).result;
  if (!raw) return null;
  await redis('EXPIRE', 'session:' + String(chatId), String(SESSION_TTL_SECONDS));
  return String(raw);
}

/**
 * Rate limit simples de /start (janela 60s).
 * @returns {Promise<boolean>} true = permitido
 */
export async function allowStart(redis, chatId) {
  const key = 'rl:tg:start:' + String(chatId);
  const n = (await redis('INCR', key)).result;
  if (n === 1) await redis('EXPIRE', key, '60');
  return Number(n || 0) <= START_RATE_LIMIT;
}

/**
 * Handler de /start (scaffold — wire no worker só na Fase 1).
 * @returns {Promise<{text:string, domain:string|null, intent:string}>}
 */
export async function handleStart(redis, text, getPlaybook) {
  const domain = parseStartPayload(text);
  if (!domain) {
    return {
      text: 'Ola! Envie o link da loja para começar (deep link com ?start=seu-codigo).',
      domain: null,
      intent: 'start_generic'
    };
  }
  if (!isValidDomain(domain)) {
    return { text: 'Link invalido.', domain: null, intent: 'start_invalid' };
  }
  const pb = typeof getPlaybook === 'function' ? await getPlaybook(domain) : null;
  if (!pb) {
    return { text: 'Loja inativa ou inexistente.', domain: null, intent: 'start_unknown' };
  }
  const brand = pb.storeName || pb.brand || domain;
  return {
    text: `Ola! Voce esta falando com a equipe da ${brand}. Como posso ajudar?`,
    domain,
    intent: 'start_bound'
  };
}

/**
 * Roteamento de mensagem com sessão (scaffold).
 * fastReplyFn e llmFn injetados pelo worker na Fase 1.
 */
export async function routeMessage(redis, chatId, text, { fastReplyFn, llmFn, getPlaybook }) {
  const domain = await resolveDomainFromChat(redis, chatId);
  if (!domain) {
    return {
      text: 'Sem sessao ativa. Clique no link da loja para comecar.',
      intent: 'no_session',
      domain: null,
      latency: 'fast'
    };
  }
  if (typeof fastReplyFn === 'function') {
    const fast = await fastReplyFn(domain, text);
    if (fast) {
      return { text: fast, intent: 'price_inquiry', domain, latency: 'fast' };
    }
  }
  const reply = typeof llmFn === 'function' ? await llmFn(domain, text, chatId) : '';
  return { text: reply, intent: 'llm_response', domain, latency: 'slow' };
}
