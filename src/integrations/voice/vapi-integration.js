/**
 * VAPI integration (Fase 2 — Voice AI sales calls)
 * Docs: https://docs.vapi.ai · Pricing: ~$0.05/min · Free: $5 crédito
 * Env: VAPI_API_KEY, VAPI_ASSISTANT_ID (Wrangler secrets — nunca commitar)
 */

export class VapiIntegration {
  constructor({ apiKey, assistantId, baseUrl = 'https://api.vapi.ai' } = {}) {
    this.apiKey = apiKey || '';
    this.assistantId = assistantId || '';
    this.baseUrl = baseUrl;
  }

  _headers() {
    return {
      Authorization: 'Bearer ' + this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  async checkAvailability() {
    if (!this.apiKey) return false;
    try {
      const res = await fetch(this.baseUrl + '/health', {
        headers: { Authorization: 'Bearer ' + this.apiKey }
      });
      return res.status === 200;
    } catch (_) {
      return false;
    }
  }

  async estimateCost(useCase = 'sales') {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(this.baseUrl + '/cost', { headers: this._headers() });
      if (!res.ok) return 0.05;
      const data = await res.json();
      return data.costPerMinute || 0.05;
    } catch (_) {
      return 0.05;
    }
  }

  async createCall({ phoneNumber, language = 'pt-BR', useCase = 'sales', metadata = {} } = {}) {
    if (!this.apiKey || !this.assistantId) {
      throw new Error('Vapi missing key/assistantId');
    }
    const res = await fetch(this.baseUrl + '/call', {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        assistantId: this.assistantId,
        phoneNumber,
        customer: { number: phoneNumber },
        metadata: {
          language,
          useCase,
          source: 'chatpay',
          ...metadata
        }
      })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('Vapi HTTP ' + res.status + ': ' + err);
    }
    const data = await res.json();
    return {
      callId: data.id,
      status: data.status || 'queued',
      phoneNumber,
      provider: 'vapi',
      estimatedCostPerMin: await this.estimateCost(useCase)
    };
  }

  async getCallStatus({ callId }) {
    if (!this.apiKey) throw new Error('Vapi missing API key');
    const res = await fetch(this.baseUrl + '/call/' + callId, {
      headers: { Authorization: 'Bearer ' + this.apiKey }
    });
    if (!res.ok) throw new Error('Vapi HTTP ' + res.status);
    const data = await res.json();
    return {
      callId,
      status: data.status,
      duration: data.duration,
      startedAt: data.startedAt,
      endedAt: data.endedAt,
      recordingUrl: data.recording?,
      cost: data.cost,
      transcript: data.transcript?.length ? data.transcript : null
    };
  }

  async endCall({ callId }) {
    if (!this.apiKey) throw new Error('Vapi missing API key');
    const res = await fetch(this.baseUrl + '/call/' + callId + '/end', {
      method: 'POST',
      headers: this._headers()
    });
    if (!res.ok) throw new Error('Vapi HTTP ' + res.status);
    return { success: true, callId };
  }

  async getTranscript({ callId }) {
    if (!this.apiKey) throw new Error('Vapi missing API key');
    const res = await fetch(this.baseUrl + '/call/' + callId + '/transcript', {
      headers: { Authorization: 'Bearer ' + this.apiKey }
    });
    if (!res.ok) throw new Error('Vapi HTTP ' + res.status);
    const data = await res.json();
    return data.transcript || '';
  }
}

export default VapiIntegration;