/**
 * MESSAGE QUEUE multi-canal (Fase 1 — scaffold)
 *
 * Ingress: webhook valida → enqueue
 * Egress:  consumer periódico → processa → channel adapter
 *
 * Nunca chamar LLM dentro do handler HTTP do Telegram/WhatsApp.
 */

import { enqueue, dequeue, queueLength, sendWithLimit } from '../integrations/channels/telegram-egress.js';

export const QUEUE_KEY = 'queue:ingress';

/**
 * Normaliza update de qualquer canal no objeto padrão interno.
 * {
 *   channel, client_domain, sender_id, session_id, text, intent?, ts
 * }
 */
export function normalizeIngress({ channel, domain, senderId, text, meta = {} }) {
  return {
    channel: channel || 'unknown',
    client_domain: String(domain || '').toLowerCase(),
    sender_id: String(senderId || ''),
    session_id: meta.sessionId || channel + ':' + senderId,
    text: String(text || '').slice(0, 2000),
    intent: meta.intent || '',
    ts: Date.now()
  };
}

/** Enfileira mensagem (webhook deve só chamar isto e retornar 200). */
export async function pushMessage(redis, msg) {
  return enqueue(redis, {
    chatId: msg.sender_id,
    botToken: msg.botToken || '',
    text: msg.text,
    intent: msg.intent || 'general',
    domain: msg.client_domain,
    channel: msg.channel
  });
}

/**
 * Consome 1 item e despacha via Telegram.
 * processFn(domain, text) → { reply, intent }
 */
export async function consumeOnce(redis, { processFn, botTokenForDomain }) {
  const item = await dequeue(redis);
  if (!item) return { empty: true };
  let reply = '';
  let intent = item.intent || 'general';
  try {
    const out = await processFn(item.domain, item.text, item.chatId);
    reply = (out && (out.text || out.reply)) || '';
    if (out && out.intent) intent = out.intent;
  } catch (e) {
    reply = 'Desculpe, tive um problema tecnico. Tente de novo.';
  }
  if (!reply) return { skipped: true, intent };
  const token = typeof botTokenForDomain === 'function'
    ? await botTokenForDomain(item.domain)
    : item.botToken;
  const sent = await sendWithLimit(token, item.chatId, reply);
  return { sent: sent.ok, intent, domain: item.domain };
}

export async function depth(redis) {
  return queueLength(redis);
}

export { enqueue, dequeue, queueLength };
