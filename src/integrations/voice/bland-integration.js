/**
 * BLAND AI integration (Fase 2 — Voice AI sales calls)
 * Docs: https://docs.bland.ai · Pricing: ~$0.10/min
 * Env: BLAND_API_KEY, BLAND_PATH_ID (Wrangler secrets — nunca commitar)
 */

export class BlandIntegration {
  constructor({ apiKey, pathId, baseUrl = 'https://api.bland.ai' } = {}) {
    this.apiKey = apiKey || '';
    this.pathId = pathId || '';
    this.baseUrl = baseUrl;
  }

  _headers() {
    return {
      Authorization: 'Bearer ' + this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  async checkAvailability() {
    return !!this.apiKey;
  }

  async estimateCost(useCase = 'sales') {
    return 0.1;
  }

  async createCall({ phoneNumber, language = 'pt-BR', useCase = 'sales', metadata = {} } = {}) {
    if (!this.apiKey) throw new Error('Bland missing API key');
    const res = await fetch(this.baseUrl + '/v1/calls', {
      method: 'POST',
      headers: this._headers(),
      body: JSON.stringify({
        path_id: this.pathId || undefined,
        phone_number: phoneNumber,
        task: 'Qualify lead (' + useCase + ', lang=' + language + ') via ChatPay',
        metadata: {
          language,
          useCase,
          source: 'chatpay',
          ...metadata
        },
        wait_module: 'dynamic_v2',
        max_duration: 600
      })
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error('Bland HTTP ' + res.status + ': ' + err);
    }
    const data = await res.json();
    return {
      callId: data.call_id || data.id,
      status: data.status || 'queued',
      phoneNumber,
      provider: 'bland',
      estimatedCostPerMin: await this.estimateCost(useCase)
    };
  }

  async getCallStatus({ callId }) {
    if (!this.apiKey) throw new Error('Bland missing API key');
    const res = await fetch(this.baseUrl + '/v1/calls/' + callId, {
      headers: { Authorization: 'Bearer ' + this.apiKey }
    });
    if (!res.ok) throw new Error('Bland HTTP ' + res.status);
    const data = await res.json();
    return {
      callId,
      status: data.status,
      duration: data.duration,
      startedAt: data.started_at,
      endedAt: data.ended_at,
      recordingUrl: data.recording_url,
      transcript: data.transcript || null,
      cost: data.cost
    };
  }

  async endCall({ callId }) {
    if (!this.apiKey) throw new Error('Bland missing API key');
    const res = await fetch(this.baseUrl + '/v1/calls/' + callId + '/stop', {
      method: 'POST',
      headers: this._headers()
    });
    if (!res.ok) throw new Error('Bland HTTP ' + res.status);
    return { success: true, callId };
  }

  async getTranscript({ callId }) {
    if (!this.apiKey) throw new Error('Bland missing API key');
    const res = await fetch(this.baseUrl + '/v1/calls/' + callId + '/transcript', {
      headers: { Authorization: 'Bearer ' + this.apiKey }
    });
    if (!res.ok) throw new Error('Bland HTTP ' + res.status);
    const data = await res.json();
    return data.transcript || '';
  }
}

export default BlandIntegration;