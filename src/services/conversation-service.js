/**
 * Conversation Service — channel-agnostic (Fase 5 scaffold)
 *
 * Ingress object:
 * {
 *   channel, client_domain, sender_id, session_id, text, intent, ts
 * }
 *
 * Pipeline: normalize → fast-path → (fila) → LLM/voice → egress format
 */

import { normalizeIngress } from './message-queue.js';

/**
 * @param {Object} deps
 * @param {(domain:string,text:string)=>Promise<string|null>} deps.fastPath
 * @param {(domain:string,text:string)=>Promise<string>} deps.llm
 * @param {(domain:string)=>Promise<Object>} deps.playbook
 */
export function createConversationService(deps) {
  const { fastPath, llm, playbook } = deps || {};

  async function handle(raw) {
    const msg = normalizeIngress(raw);
    if (!msg.client_domain || !msg.text) {
      return { ok: false, error: 'invalid_ingress' };
    }
    if (typeof fastPath === 'function') {
      const fast = await fastPath(msg.client_domain, msg.text);
      if (fast) {
        return { ok: true, ...msg, reply: fast, intent: 'price_inquiry', latency: 'fast' };
      }
    }
    const pb = typeof playbook === 'function' ? await playbook(msg.client_domain) : {};
    const reply = typeof llm === 'function' ? await llm(msg.client_domain, msg.text, pb) : '';
    return { ok: true, ...msg, reply, intent: msg.intent || 'llm_response', latency: 'slow' };
  }

  return { handle };
}
