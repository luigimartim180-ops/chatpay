/**
 * Integrações config — nomes de secrets (valores SO via env/Wrangler, nunca no repo)
 * Fases 2-5 conforme docs/roadmap/ROADMAP.md
 */

export const SECRET_NAMES = {
  voice: ['VAPI_API_KEY', 'VAPI_ASSISTANT_ID', 'BLAND_API_KEY'],
  china_voice: ['IFLYTEK_APP_ID', 'IFLYTEK_API_KEY', 'IFLYTEK_API_SECRET'],
  china_ai: ['BAIDU_API_KEY', 'BAIDU_SECRET_KEY'],
  spatial: ['XREAL_GLASSES_ADDRESS'],
  channels: ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_MASTER_BOT_TOKEN']
};

export const ACTIVATION = {
  telegram_shared: 'fase1',
  vapi: 'fase2',
  bland: 'fase2',
  iflytek: 'fase3',
  baidu: 'fase3',
  xreal: 'fase4',
  conversation_core: 'fase5'
};

/** Retorna só os nomes de env esperados (para checklist / wrangler secret list). */
export function expectedSecrets(phase) {
  const all = Object.entries(ACTIVATION);
  const out = [];
  for (const [key, ph] of all) {
    if (phase && ph !== phase) continue;
    const bucket =
      key.startsWith('vapi') || key.startsWith('bland')
        ? SECRET_NAMES.voice
        : key === 'iflytek'
          ? SECRET_NAMES.china_voice
          : key === 'baidu'
            ? SECRET_NAMES.china_ai
            : key === 'xreal'
              ? SECRET_NAMES.spatial
              : SECRET_NAMES.channels;
    out.push(...bucket);
  }
  return [...new Set(out)];
}
