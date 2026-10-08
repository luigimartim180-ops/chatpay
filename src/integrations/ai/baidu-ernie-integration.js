/**
 * BAIDU ERNIE multimodal (Fase 3 — scaffold)
 * Console: https://console.bce.baidu.com
 * Auth: OAuth2 client_credentials → access_token (30 dias)
 * Env: BAIDU_API_KEY, BAIDU_SECRET_KEY
 */

export class BaiduErnieIntegration {
  constructor({ apiKey, secretKey, baseUrl = 'https://aip.baidubce.com' } = {}) {
    this.apiKey = apiKey || '';
    this.secretKey = secretKey || '';
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;
    if (!this.apiKey || !this.secretKey) throw new Error('Baidu missing keys');
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.apiKey,
      client_secret: this.secretKey
    });
    const res = await fetch(this.baseUrl + '/oauth/2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('Baidu auth failed');
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (Number(data.expires_in || 3600) - 3600) * 1000;
    return this.accessToken;
  }

  async chat({ messages, temperature = 0.7, maxTokens = 2048 } = {}) {
    const token = await this.getAccessToken();
    const url =
      this.baseUrl +
      '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro?access_token=' +
      token;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, temperature, max_output_tokens: maxTokens })
    });
    const data = await res.json();
    if (data.error_code) throw new Error('Baidu: ' + data.error_msg);
    return { text: data.result, usage: data.usage, model: 'ernie-bot-4' };
  }

  async generateImage({ prompt, width = 512, height = 512 } = {}) {
    const token = await this.getAccessToken();
    const url =
      this.baseUrl +
      '/rpc/2.0/ai_custom/v1/wenxinworkshop/text2image?access_token=' +
      token;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, width, height, image_num: 1 })
    });
    const data = await res.json();
    if (data.error_code) throw new Error('Baidu image: ' + data.error_msg);
    return { imageUrl: data.data?.[0]?.url, width, height };
  }

  async analyzeImage({ imageUrl, prompt } = {}) {
    const token = await this.getAccessToken();
    const url =
      this.baseUrl +
      '/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro?access_token=' +
      token;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt, images: [imageUrl] }]
      })
    });
    const data = await res.json();
    if (data.error_code) throw new Error('Baidu vision: ' + data.error_msg);
    return { analysis: data.result, model: 'ernie-bot-4-vision' };
  }
}

export default BaiduErnieIntegration;
