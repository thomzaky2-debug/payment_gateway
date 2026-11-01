# NilePay: complete merchant integration walkthrough

This runnable Node.js example sells one digital license for 150 EGP. It includes a local mock gateway, real HTTP checkout creation, a durable SQLite order/session mapping, HMAC verification, duplicate-safe fulfillment, a browser return page and authenticated server-side status reconciliation. It requires Node 22.13+ (22.x). No npm packages are needed. SQLite is built into Node; Node may print an experimental SQLite warning.

## 1. Run safely with no live payments

Download and extract `/integration/nilepay-node-merchant.zip` from your merchant website. Open the extracted folder:

```sh
cp .env.example .env
npm test
npm run mock
```

Keep the mock running. In a second terminal in the same directory:

```sh
npm start
```

Open `http://localhost:8080`. The mock at `http://localhost:8090` never contacts NilePay, InstaPay or a bank.

1. Leave the example sender as `customer@instapay` and click **Create / retry checkout**. The merchant server uses its own catalog price, saves the request and sends `Idempotency-Key: merchant-order-1042-attempt-1`.
2. Click the create button again: the same session is returned. Changing the sender on that existing order is rejected. Retries must reuse the same payload and key.
3. Open checkout. Click **Simulate confirmation and signed webhook**. The mock sends the exact raw JSON with signed headers to `/webhooks/nilepay`, then returns to `/return`.
4. Click **Check payment status**. The order is `PAID` with one durable digital license. Repeat confirmation or status checks: the license stays the same.
5. Restart the merchant server while keeping the mock running. The saved order and license remain. Restarting the mock clears only its teaching sessions; use a fresh demo database when starting a new mock run. Stop the merchant first and set a new `DATABASE_FILE` in `.env`; do not delete a real merchant database.

## 2. Understand the production API flow

The merchant website's Developers page shows your API key and webhook secret after account approval. Keep both on your server. Complete the merchant's InstaPay/payment configuration and activate a valid plan or eligible trial. Install/configure the Merchant detector and enable notification access; it needs connectivity to report receipts. A checkout is confirmed from verified payment detection, never because a customer returns to your site.

The merchant website's **Live checkout tool** creates real pending sessions and reserves quota. It is not a bank sandbox, does not simulate receipt detection, and does not silently activate a trial. The local mock above is the isolated teaching environment.

Your server creates `POST /api/v1/checkout/create` with Bearer API authentication. Calculate price and items from your database, persist an immutable order and stable key, then save `checkout.sessionId` and redirect the customer to `checkout.checkoutUrl`. Use `GET /api/v1/checkout/status?sessionId=...` from your server if webhook delivery is delayed. Limit polling (for example once every 10 seconds while pending, stop at a terminal state); never expose the API key in browser JavaScript.

Fields: `amountEgp` is the EGP order total; if omitted and `items` are present, it is calculated from the items. `items` has at most 100 `{name,quantity,unitPrice,category?}` rows. Keep your amount consistent with the item total. `senderHandle` is the customer's real InstaPay handle; `note` is a human reference, not a trusted order identifier. `productCategory` is optional text up to 100 characters. `returnUrl` optionally specifies an HTTP(S) URL or local absolute path; use your HTTPS merchant return endpoint in production. It controls navigation only and is not proof of payment.

### Checkout retries

Send an optional `Idempotency-Key` of 8–128 ASCII letters, digits, `.`, `_`, `:`, or `-`, scoped to your merchant account. Persist one key per order/payment attempt before calling the gateway. Repeating the same normalized request returns the same session without reserving additional quota; changing its amount, sender, note, items, category or return URL returns HTTP 409 `IDEMPOTENCY_CONFLICT`. The association lasts while the checkout record is retained; there is no automatic 24-hour reset. A retry after expiry still returns that checkout. Check its status, and create a deliberately new attempt/key for a replacement payment only after reconciling the original order. Never generate a timestamp or random key on every network retry.

### Signed webhooks and fulfillment

In merchant **Settings → Webhooks**, configure your public HTTPS URL ending `/webhooks/nilepay`. Retrieve the webhook secret from Developers. The three required headers are `X-Instapay-Event-Id`, `X-Instapay-Timestamp` (Unix seconds), and `X-Instapay-Signature: v1=<hex>`. Compute HMAC-SHA256 over `<timestamp>.<exact raw body bytes>`, compare in constant time, and reject timestamps more than 300 seconds from your clock. Signature version is also advertised in `X-Instapay-Signature-Version`.

Event ID and delivery timestamp are headers; do not assume `event_id` or `timestamp` exists in the JSON. Payloads have `event`, merchant details and `transaction` (including `sessionId`, expected `amountEgp`, `currency`, `status`, and detection fields). Use `detectedAt`, not a guaranteed `confirmedAt` field. Underpaid/overpaid/expired events inform your reconciliation workflow and never independently authorize fulfillment; fulfill only an authenticated `CONFIRMED` transaction mapped to an order with matching expected amount/currency. Auto-accepted overpayments and configured tolerances may be represented by a confirmed transaction, so the expected order amount and authenticated final status are authoritative.

`fulfillment.mjs` commits the event ledger, PAID order and unique digital license in one SQLite transaction. Return 2xx only after committing. If a webhook arrives before session mapping is stored, return 503 so it can be retried. Repeated events and different events for an already paid session cannot grant a second license. Polling uses the same fulfillment function and cannot duplicate a license. For shipping/email/other external side effects, replace the license insert with a durable outbox job keyed by order ID and make the downstream operation idempotent; a database transaction cannot make an arbitrary external HTTP operation exactly-once.

Gateway delivery retries use backoff of 1 minute, 5 minutes, 15 minutes, 1 hour and 6 hours for ordinary delivery failures. An uncertain delivery result may pause for manual review rather than retry automatically. Review delivery logs, keep event deduplication durable, and reconcile through the authenticated status endpoint.

## 3. Connect deliberately to live NilePay

Stop the example and edit `.env` using the API origin shown in the merchant portal:

```dotenv
NILEPAY_API_URL=https://nilepay-api.runasp.net
NILEPAY_API_KEY=YOUR_REAL_SERVER_SIDE_API_KEY
NILEPAY_WEBHOOK_SECRET=YOUR_REAL_WEBHOOK_SECRET
APP_URL=https://YOUR_MERCHANT_HTTPS_HOST
ALLOW_LIVE_CHECKOUT=true
```

The host above is the current hosted API; use your portal's configured API origin if it differs. Serve the localhost example behind an HTTPS reverse proxy/tunnel and configure the webhook URL in Settings. TLS is required for public deployment; do not claim a particular TLS version is guaranteed by these examples. The demo intentionally binds to loopback. Its fixed order and unauthenticated browser controls are for learning only: add your real customer authentication/authorization, CSRF protection, order creation, inventory policy and deployment monitoring before exposing storefront routes publicly. Protect order/status/license access by customer ownership. Keep `.env` and SQLite files outside public web directories, back up your database and rotate exposed credentials.

Do not use example handles or mock secrets for live payments. A live checkout requires a genuine customer transfer; do not mark orders paid manually to test production.

## 4. Launch acceptance checks

Start with every item unchecked. Verify checkout create/retry/conflict behavior; valid and invalid signatures; timestamp rejection; duplicate deliveries; unknown sessions; amount/currency mismatches; underpaid/overpaid/expired handling; no fulfillment from browser return; process restart persistence; status reconciliation; key rotation; and failed-delivery logs. `npm test` covers fulfillment and verification. The repository additionally runs a local end-to-end HTTP flow and real-PostgreSQL gateway concurrency tests.
