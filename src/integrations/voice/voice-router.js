/**
 * VOICE ROUTER multi-provider (Fase 2 — scaffold, NÃO ativo)
 * Prioridade por idioma / custo.
 *
 * Para ativar: pedido explícito + API keys em Wrangler secrets.
 */

export const DEFAULT_PRIORITY = {
  'pt-BR': ['vapi', 'iflytek', 'bland'],
  'zh-CN': ['iflytek', 'baidu'],
  'en-US': ['vapi', 'bland'],
  default: ['vapi', 'iflytek']
};

/**
 * @param {Object} providers mapa name → { createCall, checkAvailability?, estimateCost? }
 * @param {{phoneNumber:string, language?:string, useCase?:string}} params
 */
export async function routeCall(providers, { phoneNumber, language = 'pt-BR', useCase = 'sales' }) {
  const order = DEFAULT_PRIORITY[language] || DEFAULT_PRIORITY.default;
  const errors = [];
  for (const name of order) {
    const p = providers[name];
    if (!p) continue;
    try {
      if (typeof p.checkAvailability === 'function') {
        const ok = await p.checkAvailability();
        if (!ok) continue;
      }
      const cost = typeof p.estimateCost === 'function' ? await p.estimateCost(useCase) : null;
      const result = await p.createCall({ phoneNumber, language, useCase });
      return { success: true, provider: name, callId: result.callId, estimatedCost: cost, raw: result };
    } catch (e) {
      errors.push({ provider: name, error: e.message });
    }
  }
  throw new Error('No voice provider available: ' + JSON.stringify(errors));
}

export async function routeTTS(providers, { text, language = 'pt-BR', voice = 'female' }) {
  const order = DEFAULT_PRIORITY[language] || DEFAULT_PRIORITY.default;
  for (const name of order) {
    const p = providers[name];
    if (p && typeof p.textToSpeech === 'function') {
      try {
        return { success: true, provider: name, ...(await p.textToSpeech({ text, language, voice })) };
      } catch (_) { /* next */ }
    }
  }
  throw new Error('No TTS provider available');
}

export async function routeSTT(providers, { audioBuffer, language = 'pt-BR' }) {
  const order = DEFAULT_PRIORITY[language] || DEFAULT_PRIORITY.default;
  for (const name of order) {
    const p = providers[name];
    if (p && typeof p.speechToText === 'function') {
      try {
        return { success: true, provider: name, ...(await p.speechToText({ audioBuffer, language })) };
      } catch (_) { /* next */ }
    }
  }
  throw new Error('No STT provider available');
}
