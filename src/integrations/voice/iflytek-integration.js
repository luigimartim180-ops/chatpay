/**
 * IFLYTEK TTS/STT (Fase 3 — scaffold)
 * Portal: https://console.xfyun.cn · intl: https://api.iflytek.com
 * Free: 500k chars/mês · Auth: HMAC-SHA256
 * Env: IFLYTEK_APP_ID, IFLYTEK_API_KEY, IFLYTEK_API_SECRET
 *
 * Implementação real usa WebSocket (wss://tts-api.xfyun.cn/v2/tts).
 * Aqui fica só a assinatura de auth + interface compatível com VoiceRouter.
 */

import crypto from 'node:crypto';

export function generateIflytekAuth({ apiKey, apiSecret, host, date, path }) {
  const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`;
  const signature = crypto.createHmac('sha256', apiSecret).update(signatureOrigin).digest('base64');
  const authorization =
    `api_key="${apiKey}", algorithm="hmac-sha256", ` +
    `headers="host date request-line", signature="${signature}"`;
  return Buffer.from(authorization).toString('base64');
}

export class IflytekIntegration {
  constructor({ appId, apiKey, apiSecret } = {}) {
    this.appId = appId || '';
    this.apiKey = apiKey || '';
    this.apiSecret = apiSecret || '';
  }

  async checkAvailability() {
    return !!(this.appId && this.apiKey && this.apiSecret);
  }

  async estimateCost() {
    return 0.01; // USD/min equiv.
  }

  /** Interface VoiceRouter — full impl na Fase 3 (WebSocket). */
  async textToSpeech() {
    throw new Error('iFlytek TTS: implementar na Fase 3 (WebSocket tts-api.xfyun.cn)');
  }

  async speechToText() {
    throw new Error('iFlytek STT: implementar na Fase 3 (WebSocket iat-api.xfyun.cn)');
  }

  async createCall() {
    throw new Error('iFlytek não suporta voice agent completo — usar Vapi/Bland');
  }
}

export default IflytekIntegration;
