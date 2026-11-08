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
  if (!eventId || !timestamp || typeof signature !== 'string' || !secret || (typeof rawBody !== 'string' && !Buffer.isBuffer(rawBody))) return false;
  const seconds = Number(timestamp);
  if (!Number.isSafeInteger(seconds) || Math.abs(now - seconds * 1000) > 300_000) return false;
  const received = signature.replace(/^v1=/, '');
  if (!/^[0-9a-f]{64}$/i.test(received)) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(rawBody).digest();
  if (!crypto.timingSafeEqual(Buffer.from(received, 'hex'), expected)) return false;
  try {
    const parsed = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody);
    if (parsed && typeof parsed.eventId === 'string' && parsed.eventId !== eventId) return false;
  } catch {
    return false;
  }
  return true;
}

export function createWebhookRouter({ secret, deduplicateAndCommit, destinations = {} }) {
  if (!secret) throw new Error('secret is required');
  const seenEventIds = new Set();
  return async function handleWebhook({ rawBody, headers }) {
    const eventId = headers['x-instapay-event-id'];
    const timestamp = headers['x-instapay-timestamp'];
    const signature = headers['x-instapay-signature'];
    if (!verifyWebhook({ rawBody, eventId, timestamp, signature, secret })) {
      throw Object.assign(new Error('Invalid webhook signature or timestamp'), { status: 401 });
    }
    const payload = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody));
    const effectiveEventId = payload?.eventId || eventId;
    if (!deduplicateAndCommit && seenEventIds.has(effectiveEventId)) {
      return { received: true, duplicate: true, dispatched: [] };
    }
    const commitResult = deduplicateAndCommit ? await deduplicateAndCommit({ eventId: effectiveEventId, payload, rawBody }) : { duplicate: false };
    if (commitResult?.duplicate) return { received: true, duplicate: true, dispatched: [] };
    const dispatched = [];
    try {
      for (const [name, handler] of Object.entries(destinations)) {
        if (typeof handler === 'function') {
          await handler(payload, { eventId: effectiveEventId, destination: name });
          dispatched.push(name);
        }
      }
      if (!deduplicateAndCommit && effectiveEventId) {
        if (seenEventIds.size >= 10_000) seenEventIds.clear();
        seenEventIds.add(effectiveEventId);
      }
    } catch (err) {
      if (typeof commitResult?.rollback === 'function') await commitResult.rollback();
      throw err;
    }
    return { received: true, duplicate: false, dispatched };
  };
}
