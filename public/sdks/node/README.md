# @nilepay/node

Install this package from your approved registry or copy it into a private server-side package. Never bundle the API key or webhook secret into a browser/mobile app.

```js
import { NilePayClient, verifyWebhook } from '@nilepay/node';
const nilepay = new NilePayClient({ apiKey: process.env.NILEPAY_API_KEY });
const checkout = await nilepay.createCheckout({ amountEgp: 150, senderHandle: 'customer@instapay', note: 'Order #1042' }, 'order-1042-attempt-1');
```

Persist the idempotency key before the request. Verify the exact raw webhook body, persist the event ID, and fulfill only a confirmed, amount/currency-matching order.
