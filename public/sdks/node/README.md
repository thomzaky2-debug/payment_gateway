# @nilepay/node

Install this package from your approved registry or copy it into a private server-side package. Never bundle the API key or webhook secret into a browser/mobile app.

```js
import { NilePayClient, verifyWebhook, createWebhookRouter } from '@nilepay/node';
const nilepay = new NilePayClient({ apiKey: process.env.NILEPAY_API_KEY });
const checkout = await nilepay.createCheckout({ amountEgp: 150, senderHandle: 'customer@instapay', note: 'Order #1042' }, 'order-1042-attempt-1');

// Central Event Router: verify once, deduplicate atomically, and fan out to multiple internal services
const routeWebhook = createWebhookRouter({
  secret: process.env.NILEPAY_WEBHOOK_SECRET,
  deduplicateAndCommit: async ({ eventId, payload }) => commitOrderAndEventId(eventId, payload),
  destinations: {
    notifications: async (payload) => sendReceiptEmailOrWhatsApp(payload.transaction),
    crm: async (payload) => syncAccountingLedger(payload.transaction),
  },
});
```

Persist the idempotency key before the request. Verify the exact raw webhook body, persist the event ID, and fulfill only a confirmed, amount/currency-matching order. Use a single webhook endpoint as a central router to fan out to multiple downstream services after committing.
