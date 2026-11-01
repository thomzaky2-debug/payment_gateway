import crypto from 'node:crypto';

export class NilePayClient {
  constructor({ apiKey, baseUrl = 'https://nilepay-api.runasp.net', fetchImpl = fetch }) {
    if (!apiKey) throw new Error('apiKey is required');
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetch = fetchImpl;
  }
  async createCheckout(input, idempotencyKey) {
    if (!idempotencyKey) throw new Error('Persist and provide an Idempotency-Key for every order attempt');
    return this.#request('/api/v1/checkout/create', { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey }, body: input });
  }
  getCheckout(sessionId) { return this.#request(`/api/v1/checkout/status?sessionId=${encodeURIComponent(sessionId)}`); }
  async #request(path, init = {}) {
    const response = await this.fetch(this.baseUrl + path, { ...init, headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json', ...(init.headers || {}) }, body: init.body ? JSON.stringify(init.body) : undefined });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(json.error || `NilePay API error ${response.status}`), { status: response.status, body: json });
    return json;
  }
}

export function verifyWebhook({ rawBody, eventId, timestamp, signature, secret, now = Date.now() }) {
  if (!eventId || !timestamp || !signature || !secret) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(now - seconds * 1000) > 300_000) return false;
  const received = signature.replace(/^v1=/, '');
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest('hex');
  return received.length === expected.length && crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}
