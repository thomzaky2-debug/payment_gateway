# InstaPay Gateway — API Integration & Implementation Guide

> **Version:** 2.0.0  
> **Security Protocol:** TLS 1.3, Bearer API Key, HMAC-SHA256 Signatures, Anti-Replay Timestamp Defense  
> **Currency:** Egyptian Pound (`EGP`)

---

## Table of Contents

1. [Architecture & Payment Flow](#1-architecture--payment-flow)
2. [Authentication & Environments](#2-authentication--environments)
3. [REST API Reference](#3-rest-api-reference)
   - [3.1 Create Checkout Session](#31-create-checkout-session)
   - [3.2 Check Checkout Status](#32-check-checkout-status)
   - [3.3 Public Checkout Endpoint](#33-public-checkout-endpoint)
   - [3.4 Rotate Integration Keys](#34-rotate-integration-keys)
4. [Webhook Architecture & Signature Verification](#4-webhook-architecture--signature-verification)
   - [4.1 Inbound Webhook Headers](#41-inbound-webhook-headers)
   - [4.2 HMAC-SHA256 Verification Algorithm](#42-hmac-sha256-verification-algorithm)
   - [4.3 Anti-Replay Defense](#43-anti-replay-defense)
   - [4.4 Event Types & Payload Schemas](#44-event-types--payload-schemas)
   - [4.5 Delivery Guarantee & Exponential Backoff](#45-delivery-guarantee--exponential-backoff)
5. [Full End-to-End Implementations](#5-full-end-to-end-implementations)
   - [5.1 Node.js / Express (TypeScript & JavaScript)](#51-nodejs--express-typescript--javascript)
   - [5.2 Python (FastAPI & Flask)](#52-python-fastapi--flask)
   - [5.3 PHP (Modern PHP 8+ & Laravel)](#53-php-modern-php-8--laravel)
   - [5.4 Go (Golang)](#54-go-golang)
   - [5.5 cURL & Shell Scripts](#55-curl--shell-scripts)
6. [Error Handling & Lifecycle Status Matrix](#6-error-handling--lifecycle-status-matrix)
7. [Production Readiness Checklist](#7-production-readiness-checklist)

---

## 1. Architecture & Payment Flow

The InstaPay Payment Gateway allows e-commerce platforms, mobile applications, and subscription services to accept instant Egyptian Pound transfers via Egypt's national Instant Payment Network (IPN / InstaPay).

```
┌──────────────────┐               ┌──────────────────┐               ┌──────────────────┐
│  Customer Device │               │ Merchant Backend │               │ InstaPay Gateway │
└────────┬─────────┘               └────────┬─────────┘               └────────┬─────────┘
         │                                  │                                  │
         │  1. Customer Clicks "Checkout"  │                                  │
         │ ────────────────────────────────>│                                  │
         │                                  │  2. POST /api/v1/checkout/create │
         │                                  │     (Bearer egp_live_...)        │
         │                                  │ ────────────────────────────────>│
         │                                  │                                  │
         │                                  │  3. Returns checkoutUrl,         │
         │                                  │     sessionId, deepLinkUrl       │
         │                                  │ <────────────────────────────────│
         │                                  │                                  │
         │  4. Redirect Customer to         │                                  │
         │     checkoutUrl or open deepLink │                                  │
         │ <────────────────────────────────│                                  │
         │                                                                     │
         │  5. Customer Pays via InstaPay App (Sends EGP to Merchant Handle)   │
         │ ───────────────────────────────────────────────────────────────────>│
         │                                                                     │
         │                                                                     │ 6. Companion Android
         │                                                                     │    Detector captures
         │                                                                     │    bank push receipt
         │                                                                     │
         │                                  │  7. POST Merchant Webhook        │
         │                                  │     (X-Instapay-Signature HMAC)  │
         │                                  │ <────────────────────────────────│
         │                                  │                                  │
         │                                  │  8. Verifies HMAC & Timestamp,   │
         │                                  │     Fulfills Order,              │
         │                                  │     Returns HTTP 200 OK          │
         │                                  │ ────────────────────────────────>│
         │                                  │                                  │
         │  9. Customer redirected to Success Page                             │
         │ <───────────────────────────────────────────────────────────────────│
```

### Key Concepts

- **Checkout Session (`sessionId`):** A transient payment invoice uniquely identified by the `cmt_` prefix (e.g. `cmt_9e8a7b6c5d4e3f2a1b0c9d8e`). Each session has a configurable Time-To-Live (TTL, default 10–15 minutes).
- **IPN Deep Link:** A direct mobile URI (`https://ipn.eg/S/<handle>/instapay/<token>`) that opens the customer's installed InstaPay app with the recipient handle and required amount pre-filled.
- **Companion Detector Ingestion:** The gateway's zero-access Android companion device reads official bank SMS/push notifications issued by the Central Bank of Egypt's IPN switch, validates the recipient handle, timestamp, and amount, and matches it atomically to the outstanding session.
- **HMAC Signed Webhook:** An authenticated HTTP `POST` dispatch informing the merchant's server that payment has been confirmed, underpaid, or overpaid.

---

## 2. Authentication & Environments

All merchant REST API requests must include your private API key in the `Authorization` HTTP header using the `Bearer` scheme.

```http
Authorization: Bearer egp_live_9a7b3c2d1e0f8a4b6c8d0e2f
Content-Type: application/json
```

### Base URLs

| Environment | Base URL | Notes |
| :--- | :--- | :--- |
| **Production** | `https://your-domain.com` | Requires TLS 1.3 / HTTPS. All endpoints enforced. |
| **Local Development** | `http://localhost:3001` | Default port when running via `start-local.sh`. |
| **Client Hosted Checkout** | `http://localhost:3000` | Frontend UI hosting the `/pay/:sessionId` checkout flow. |

> [!IMPORTANT]
> **API Key Format:** Live merchant API keys always start with `egp_live_` or `egp_test_`. Keep your API key strictly confidential. Never commit keys to public repositories or expose them in client-side mobile/browser bundles.

---

## 3. REST API Reference

### 3.1 Create Checkout Session

Initializes a new payment session and generates the hosted payment URL and InstaPay mobile deep-link.

- **Method:** `POST`
- **Path:** `/api/v1/checkout/create`
- **Authentication:** `Bearer <API_KEY>`

#### Request Headers

```http
POST /api/v1/checkout/create HTTP/1.1
Host: your-domain.com
Authorization: Bearer egp_live_9a7b3c2d1e0f8a4b6c8d0e2f
Content-Type: application/json
```

#### Request Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `amountEgp` | `number` | **Yes** | Total amount to charge in Egyptian Pounds (EGP). Minimum: `0.01`, Maximum: `10,000,000.00`. Will be rounded to 2 decimal places. |
| `senderHandle` | `string` | No | Expected customer InstaPay IPA/handle (e.g. `customer@instapay`). Defaults to `pending@instapay` if omitted. |
| `note` | `string` | No | Merchant reference, Order ID, or description (e.g. `Order #1042`). Displayed on receipt and passed to webhooks. |

#### Request Body Example

```json
{
  "amountEgp": 150.00,
  "senderHandle": "customer@instapay",
  "note": "Order #1042 - Premium Plan"
}
```

#### Response (201 Created)

```json
{
  "ok": true,
  "checkout": {
    "sessionId": "cmt_8f1b2c3d4e5f6a7b8c9d0e1f",
    "status": "PENDING",
    "amountEgp": 150.00,
    "currency": "EGP",
    "deepLinkUrl": "https://ipn.eg/S/merchantname/instapay/a7b8c9d0",
    "checkoutUrl": "https://your-domain.com/pay/cmt_8f1b2c3d4e5f6a7b8c9d0e1f",
    "recipientHandle": "merchantname@instapay",
    "senderHandle": "customer@instapay",
    "expiresAt": "2026-10-10T16:15:00.000Z"
  }
}
```

---

### 3.2 Check Checkout Status

Polls or inspects the real-time settlement status of an existing checkout session.

- **Method:** `GET`
- **Path:** `/api/v1/checkout/status`
- **Authentication:** `Bearer <API_KEY>`

#### Query Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `sessionId` | `string` | **Yes** | The session ID returned during creation (e.g. `cmt_8f1b2c3d4e5f6a7b8c9d0e1f`). |

#### Request Example

```http
GET /api/v1/checkout/status?sessionId=cmt_8f1b2c3d4e5f6a7b8c9d0e1f HTTP/1.1
Host: your-domain.com
Authorization: Bearer egp_live_9a7b3c2d1e0f8a4b6c8d0e2f
```

#### Response (200 OK)

```json
{
  "ok": true,
  "checkout": {
    "sessionId": "cmt_8f1b2c3d4e5f6a7b8c9d0e1f",
    "status": "CONFIRMED",
    "amountEgp": 150.00,
    "currency": "EGP",
    "senderHandle": "customer@instapay",
    "recipientHandle": "merchantname@instapay",
    "detectedRef": "REF20261010778899",
    "detectedAt": "2026-10-10T16:03:22.000Z",
    "detectedAmountEgp": 150.00,
    "createdAt": "2026-10-10T16:00:00.000Z",
    "expiresAt": "2026-10-10T16:15:00.000Z"
  }
}
```

---

### 3.3 Public Checkout Endpoint

Used by hosted checkout customer web pages and mobile webviews to display payment instructions and QR codes.

- **Method:** `GET`
- **Path:** `/api/checkout/:sessionId`
- **Authentication:** Public (No Bearer token required)

#### Response (200 OK)

```json
{
  "ok": true,
  "checkout": {
    "sessionId": "cmt_8f1b2c3d4e5f6a7b8c9d0e1f",
    "status": "PENDING",
    "amountEgp": 150.00,
    "currency": "EGP",
    "senderHandle": "customer@instapay",
    "recipientHandle": "merchantname@instapay",
    "businessName": "Cairo Retail Hub",
    "deepLinkUrl": "https://ipn.eg/S/merchantname/instapay/a7b8c9d0",
    "note": "Order #1042",
    "secondsRemaining": 842,
    "expiresAt": "2026-10-10T16:15:00.000Z"
  }
}
```

---

### 3.4 Rotate Integration Keys

Generates a new API Key, Android Detector Token, and Webhook Signing Secret.

- **Method:** `POST`
- **Path:** `/api/settings/rotate-keys`
- **Authentication:** Authenticated Merchant Session Cookie

#### Response (200 OK)

```json
{
  "ok": true,
  "apiKey": "egp_live_new_credential_hash_4f8b2c",
  "detectToken": "dtk_live_new_token_7a1c9e",
  "webhookSecret": "whsec_new_secret_3d5f8a"
}
```

---

## 4. Webhook Architecture & Signature Verification

When a payment is matched and verified, the gateway immediately dispatches an HTTP `POST` request to your configured **Webhook URL**. To guarantee data authenticity and prevent spoofing or tampering, every request is cryptographically signed.

### 4.1 Inbound Webhook Headers

Every webhook dispatch includes four dedicated security headers:

| Header Name | Format / Example | Description |
| :--- | :--- | :--- |
| `X-Instapay-Signature` | `v1=9e8a7b6c5d4e3f...` | Hex-encoded HMAC-SHA256 signature prefixed with `v1=`. |
| `X-Instapay-Timestamp` | `1791625400` | Unix epoch time in seconds when the webhook was generated. |
| `X-Instapay-Event-Id` | `evt_3f8b1c2d4e5a6f...` | Unique dispatch event UUID for idempotent deduplication. |
| `X-Instapay-Signature-Version` | `v1` | Signature algorithm version identifier. |
| `User-Agent` | `InstaPay-Gateway-Webhook/2.0` | Gateway dispatcher client identifier. |

---

### 4.2 HMAC-SHA256 Verification Algorithm

To verify that the request originated from the gateway:

1. **Extract Headers:** Read `X-Instapay-Signature` and `X-Instapay-Timestamp`.
2. **Obtain Raw Body:** Extract the raw, unparsed request payload bytes directly from the network stream.
3. **Form the Base String:** Concatenate the integer timestamp, a literal period (`.`), and the raw JSON string:
   $$\text{BaseString} = \text{Timestamp} + \text{"."} + \text{RawBody}$$
4. **Compute Hash:** Calculate the HMAC-SHA256 digest of the BaseString using your `webhookSecret` (`whsec_...`):
   $$\text{ExpectedSig} = \text{HMAC-SHA256}(\text{BaseString}, \text{Secret})$$
5. **Constant-Time Comparison:** Compare the computed 64-character hex string against the signature provided in `X-Instapay-Signature` (stripping the `v1=` prefix) using a timing-attack safe comparison function.

```
       X-Instapay-Timestamp: "1791625400"
                              │
                              ▼
            Base String: "1791625400.{"event":"payment.confirmed",...}"
                              │
                              ▼
                + Webhook Secret ("whsec_...")
                              │
                              ▼
                        HMAC-SHA256
                              │
                              ▼
               "v1=9e8a7b6c5d4e3f2a1b0c9d8e7f..."
```

> [!WARNING]
> **Never verify parsed JSON!** Re-serializing parsed JSON (e.g. `JSON.stringify(req.body)`) may alter whitespace, unicode formatting, or key ordering, which causes HMAC verification to fail. Always capture the raw byte buffer from the HTTP request.

---

### 4.3 Anti-Replay Defense

To protect your server against replay attacks (where an attacker intercepts a valid webhook and replays it later):

1. Parse `X-Instapay-Timestamp` as an integer.
2. Obtain current system Unix timestamp: `now = Math.floor(Date.now() / 1000)`.
3. Reject requests if:
   $$|\text{now} - \text{timestamp}| > 300\text{ seconds (5 minutes)}$$

---

### 4.4 Event Types & Payload Schemas

#### Event Types

| Event Name | Meaning | Recommended Merchant Action |
| :--- | :--- | :--- |
| `payment.confirmed` | Exact payment received and matched. | **Fulfill order**, activate subscription, or grant credits. |
| `payment.underpaid` | Customer transferred less than required amount. | Notify customer of remaining balance or request manual review. |
| `payment.overpaid` | Customer transferred more than required amount. | Fulfill order and credit difference to customer balance. |
| `payment.expired` | Checkout session expired without receipt. | Cancel order reservation or release locked inventory. |

#### Complete Webhook Payload Example (`payment.confirmed`)

```json
{
  "event": "payment.confirmed",
  "clientId": "client_cairo_retail_hub",
  "businessName": "Cairo Retail Hub",
  "transaction": {
    "sessionId": "cmt_8f1b2c3d4e5f6a7b8c9d0e1f",
    "senderHandle": "customer@instapay",
    "recipientHandle": "cairohub@instapay",
    "amountEgp": 150.00,
    "detectedAmountEgp": 150.00,
    "currency": "EGP",
    "status": "CONFIRMED",
    "detectedRef": "REF20261010778899",
    "detectedAt": "2026-10-10T16:03:22.000Z",
    "note": "Order #1042 - Premium Plan",
    "createdAt": "2026-10-10T16:00:00.000Z"
  }
}
```

---

### 4.5 Delivery Guarantee & Exponential Backoff

Your webhook endpoint must return an HTTP status code between `200` and `299` within **10 seconds**.

If your endpoint times out or returns a non-2xx status, the gateway automatically queues the notification in an asynchronous retry worker using an exponential backoff schedule:

| Attempt | Delay After Failure | Description |
| :---: | :---: | :--- |
| **1** | Immediate | First live delivery attempt |
| **2** | 1 minute | First automated retry |
| **3** | 5 minutes | Second retry |
| **4** | 15 minutes | Third retry |
| **5** | 1 hour | Fourth retry |
| **6** | 6 hours | Final retry before marking as permanently failed |

---

## 5. Full End-to-End Implementations

### 5.1 Node.js / Express (TypeScript & JavaScript)

Here is a complete, production-ready server demonstrating checkout session generation, raw-body HMAC signature verification, timing-safe evaluation, and idempotent order fulfillment:

```typescript
import express, { Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';

const app = express();

const GATEWAY_BASE_URL = process.env.INSTAPAY_BASE_URL || 'https://your-domain.com';
const API_KEY = process.env.INSTAPAY_API_KEY || 'egp_live_9a7b3c2d1e0f8a4b6c8d0e2f';
const WEBHOOK_SECRET = process.env.INSTAPAY_WEBHOOK_SECRET || 'whsec_e8f2a1b9c3d4e5f6a7b8c9d0';

// ─── Step 1: Create Checkout Session Helper ────────────────────────
export async function createPayment(amountEgp: number, orderId: string, customerHandle?: string) {
  const response = await axios.post(
    `${GATEWAY_BASE_URL}/api/v1/checkout/create`,
    {
      amountEgp,
      senderHandle: customerHandle || 'pending@instapay',
      note: `Order #${orderId}`,
    },
    {
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    }
  );

  const { checkout } = response.data;
  console.log(`[InstaPay] Session created: ${checkout.sessionId}`);
  console.log(`[InstaPay] Customer Payment URL: ${checkout.checkoutUrl}`);

  return checkout; // Redirect customer to checkout.checkoutUrl
}

// ─── Step 2: Webhook Endpoint with Raw Body Parser ──────────────────
// CRITICAL: Use express.raw() to capture the exact, unparsed request bytes
app.post(
  '/api/webhooks/instapay',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response) => {
    try {
      const signatureHeader = req.headers['x-instapay-signature'] as string;
      const timestampHeader = req.headers['x-instapay-timestamp'] as string;
      const eventId = req.headers['x-instapay-event-id'] as string;

      if (!signatureHeader || !timestampHeader) {
        return res.status(400).send('Missing signature headers');
      }

      // 1. Anti-Replay: Check 300 second (5 minute) tolerance window
      const currentTime = Math.floor(Date.now() / 1000);
      const timestamp = parseInt(timestampHeader, 10);
      if (isNaN(timestamp) || Math.abs(currentTime - timestamp) > 300) {
        return res.status(400).send('Timestamp expired or outside 5-minute tolerance');
      }

      // 2. Extract hex signature from 'v1=<hex>'
      const incomingSignature = signatureHeader.startsWith('v1=')
        ? signatureHeader.slice(3)
        : signatureHeader;

      // 3. Construct base string: "<timestamp>.<rawBody>"
      const rawBody = req.body.toString('utf8');
      const baseString = `${timestampHeader}.${rawBody}`;

      // 4. Compute expected HMAC-SHA256 signature
      const computedSignature = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(baseString)
        .digest('hex');

      // 5. Timing-safe comparison to prevent side-channel timing attacks
      const incomingBuffer = Buffer.from(incomingSignature, 'utf8');
      const computedBuffer = Buffer.from(computedSignature, 'utf8');

      if (
        incomingBuffer.length !== 64 ||
        computedBuffer.length !== 64 ||
        !crypto.timingSafeEqual(incomingBuffer, computedBuffer)
      ) {
        console.error('[InstaPay] Invalid HMAC signature detected!');
        return res.status(401).send('Signature verification failed');
      }

      // 6. Signature verified! Parse payload and process idempotently
      const payload = JSON.parse(rawBody);
      const { event, transaction } = payload;
      console.log(`[InstaPay] Verified Event: ${event} (Event ID: ${eventId})`);

      // 7. Handle transaction state idempotently
      switch (event) {
        case 'payment.confirmed':
          // Customer paid exact amount. Fulfill order in your database:
          // await markOrderPaid(transaction.sessionId, transaction.amountEgp, transaction.detectedRef);
          console.log(`Order fulfilled: Session ${transaction.sessionId}, Ref: ${transaction.detectedRef}`);
          break;

        case 'payment.underpaid':
          // Customer underpaid:
          console.warn(`Payment underpaid: Expected ${transaction.amountEgp}, got ${transaction.detectedAmountEgp}`);
          break;

        case 'payment.overpaid':
          // Customer overpaid:
          console.info(`Payment overpaid: Excess credited.`);
          break;

        case 'payment.expired':
          // Session timed out:
          console.info(`Session expired: ${transaction.sessionId}`);
          break;

        default:
          console.log(`Unhandled event type: ${event}`);
      }

      // 8. Return HTTP 200 within 10 seconds to acknowledge receipt
      return res.status(200).json({ received: true });
    } catch (err: any) {
      console.error('[InstaPay] Webhook error:', err);
      return res.status(500).send('Internal server error');
    }
  }
);

// ─── Step 3: Example Route to Trigger Checkout ──────────────────────
app.get('/buy-item', async (_req, res) => {
  try {
    const checkout = await createPayment(299.99, 'INV-9001', 'buyer@instapay');
    res.redirect(checkout.checkoutUrl);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(3000, () => {
  console.log('Merchant integration server running on port 3000');
});
```

---

### 5.2 Python (FastAPI & Flask)

#### FastAPI Implementation

```python
import hmac
import hashlib
import time
import json
import httpx
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import JSONResponse

app = FastAPI(title="InstaPay Merchant Integration")

GATEWAY_BASE_URL = "https://your-domain.com"
API_KEY = "egp_live_9a7b3c2d1e0f8a4b6c8d0e2f"
WEBHOOK_SECRET = "whsec_e8f2a1b9c3d4e5f6a7b8c9d0"

# ─── 1. Create Checkout Session Helper ─────────────────────────────
async def create_checkout(amount_egp: float, order_id: str, sender_handle: str = "pending@instapay") -> dict:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{GATEWAY_BASE_URL}/api/v1/checkout/create",
            json={
                "amountEgp": amount_egp,
                "senderHandle": sender_handle,
                "note": f"Order #{order_id}"
            },
            headers={
                "Authorization": f"Bearer {API_KEY}",
                "Content-Type": "application/json"
            },
            timeout=10.0
        )
        resp.raise_for_status()
        data = resp.json()
        return data["checkout"]

# ─── 2. Webhook Receiver with HMAC Verification ─────────────────────
@app.post("/api/webhooks/instapay")
async def handle_webhook(request: Request):
    sig_header = request.headers.get("x-instapay-signature", "")
    ts_header = request.headers.get("x-instapay-timestamp", "")

    if not sig_header or not ts_header:
        raise HTTPException(status_code=400, detail="Missing signature headers")

    # Anti-Replay: 300 seconds (5 minute) tolerance
    try:
        ts = int(ts_header)
        if abs(int(time.time()) - ts) > 300:
            raise HTTPException(status_code=400, detail="Timestamp expired")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid timestamp")

    # Read raw body bytes
    raw_body = await request.body()
    base_string = f"{ts_header}.".encode("utf-8") + raw_body

    # Compute expected signature
    expected_sig = hmac.new(
        WEBHOOK_SECRET.encode("utf-8"),
        base_string,
        hashlib.sha256
    ).hexdigest()

    incoming_sig = sig_header[3:] if sig_header.startswith("v1=") else sig_header

    # Timing-safe comparison
    if not hmac.compare_digest(incoming_sig, expected_sig):
        raise HTTPException(status_code=401, detail="Signature mismatch")

    payload = json.loads(raw_body.decode("utf-8"))
    event = payload.get("event")
    tx = payload.get("transaction", {})

    print(f"[InstaPay] Verified Event: {event} for Session {tx.get('sessionId')}")

    if event == "payment.confirmed":
        # Fulfill order in database:
        print(f"Order #{tx.get('note')} PAID! Ref: {tx.get('detectedRef')}")

    return JSONResponse(content={"received": True}, status_code=200)
```

---

### 5.3 PHP (Modern PHP 8+ & Laravel)

#### Modern Vanilla PHP (`webhook.php`)

```php
<?php
declare(strict_types=1);

$webhookSecret = getenv('INSTAPAY_WEBHOOK_SECRET') ?: 'whsec_e8f2a1b9c3d4e5f6a7b8c9d0';

// 1. Read headers and unparsed raw body
$sigHeader = $_SERVER['HTTP_X_INSTAPAY_SIGNATURE'] ?? '';
$tsHeader  = $_SERVER['HTTP_X_INSTAPAY_TIMESTAMP'] ?? '';
$rawBody   = file_get_contents('php://input');

if (empty($sigHeader) || empty($tsHeader) || $rawBody === false) {
    http_response_code(400);
    exit(json_encode(['error' => 'Missing signature headers']));
}

// 2. Anti-Replay Defense: Verify 300-second freshness window
$currentTime = time();
$timestamp = (int)$tsHeader;
if (abs($currentTime - $timestamp) > 300) {
    http_response_code(400);
    exit(json_encode(['error' => 'Timestamp outside 5-minute tolerance']));
}

// 3. Extract signature and compute HMAC-SHA256
$signature = str_starts_with($sigHeader, 'v1=') ? substr($sigHeader, 3) : $sigHeader;
$baseString = $tsHeader . '.' . $rawBody;
$computedSignature = hash_hmac('sha256', $baseString, $webhookSecret);

// 4. Constant-time comparison (prevents timing attacks)
if (!hash_equals($signature, $computedSignature)) {
    http_response_code(401);
    exit(json_encode(['error' => 'Invalid HMAC signature']));
}

// 5. Payload is authentic: Process event
$data = json_decode($rawBody, true);
$event = $data['event'] ?? '';
$tx = $data['transaction'] ?? [];

if ($event === 'payment.confirmed') {
    // Fulfill customer order idempotently in DB:
    // fulfillOrder($tx['sessionId'], $tx['amountEgp'], $tx['detectedRef']);
}

// 6. Return 200 OK within 10 seconds
http_response_code(200);
header('Content-Type: application/json');
echo json_encode(['received' => true]);
```

#### Laravel Controller (`InstaPayWebhookController.php`)

```php
<?php
namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class InstaPayWebhookController extends Controller
{
    public function handle(Request $request): JsonResponse
    {
        $sigHeader = $request->header('X-Instapay-Signature');
        $tsHeader  = $request->header('X-Instapay-Timestamp');
        $rawBody   = $request->getContent(); // Raw body string

        if (!$sigHeader || !$tsHeader) {
            return response()->json(['error' => 'Missing signature headers'], 400);
        }

        // Anti-Replay
        if (abs(time() - (int)$tsHeader) > 300) {
            return response()->json(['error' => 'Timestamp outside 5-minute tolerance'], 400);
        }

        $secret = config('services.instapay.webhook_secret');
        $incomingSig = str_starts_with($sigHeader, 'v1=') ? substr($sigHeader, 3) : $sigHeader;
        $computedSig = hash_hmac('sha256', "{$tsHeader}.{$rawBody}", $secret);

        if (!hash_equals($incomingSig, $computedSig)) {
            return response()->json(['error' => 'Signature mismatch'], 401);
        }

        $payload = json_decode($rawBody, true);
        if ($payload['event'] === 'payment.confirmed') {
            // Fulfill Order
        }

        return response()->json(['received' => true], 200);
    }
}
```

---

### 5.4 Go (Golang)

```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

var (
	webhookSecret = os.Getenv("INSTAPAY_WEBHOOK_SECRET")
)

type WebhookPayload struct {
	Event       string      `json:"event"`
	ClientId    string      `json:"clientId"`
	Transaction Transaction `json:"transaction"`
}

type Transaction struct {
	SessionId       string  `json:"sessionId"`
	AmountEgp       float64 `json:"amountEgp"`
	Status          string  `json:"status"`
	DetectedRef     *string `json:"detectedRef"`
	SenderHandle    string  `json:"senderHandle"`
	RecipientHandle string  `json:"recipientHandle"`
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
		return
	}

	sigHeader := r.Header.Get("X-Instapay-Signature")
	tsHeader := r.Header.Get("X-Instapay-Timestamp")
	if sigHeader == "" || tsHeader == "" {
		http.Error(w, "Missing required signature headers", http.StatusBadRequest)
		return
	}

	// 1. Anti-Replay Check (300 seconds)
	timestamp, err := strconv.ParseInt(tsHeader, 10, 64)
	if err != nil || math.Abs(float64(time.Now().Unix()-timestamp)) > 300 {
		http.Error(w, "Timestamp outside 5-minute tolerance", http.StatusBadRequest)
		return
	}

	// 2. Read raw unparsed request body
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Failed to read request body", http.StatusInternalServerError)
		return
	}

	// 3. Construct Base String: "<timestamp>.<rawBody>"
	baseString := append([]byte(tsHeader+"."), rawBody...)

	// 4. Calculate HMAC-SHA256
	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(baseString)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	incomingSig := strings.TrimPrefix(sigHeader, "v1=")

	// 5. Constant-time comparison
	if subtle.ConstantTimeCompare([]byte(incomingSig), []byte(expectedSig)) != 1 {
		http.Error(w, "Signature mismatch", http.StatusUnauthorized)
		return
	}

	// 6. Process Verified Payload
	var payload WebhookPayload
	if err := json.Unmarshal(rawBody, &payload); err != nil {
		http.Error(w, "Invalid JSON payload", http.StatusBadRequest)
		return
	}

	fmt.Printf("[InstaPay] Verified Event: %s, Session: %s\n", payload.Event, payload.Transaction.SessionId)

	if payload.Event == "payment.confirmed" {
		// Fulfill order
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"received":true}`))
}

func main() {
	if webhookSecret == "" {
		webhookSecret = "whsec_e8f2a1b9c3d4e5f6a7b8c9d0"
	}
	http.HandleFunc("/api/webhooks/instapay", webhookHandler)
	fmt.Println("Listening for InstaPay webhooks on :8080...")
	http.ListenAndServe(":8080", nil)
}
```

---

### 5.5 cURL & Shell Scripts

#### Create a Checkout Session

```bash
curl -X POST "https://your-domain.com/api/v1/checkout/create" \
  -H "Authorization: Bearer egp_live_9a7b3c2d1e0f8a4b6c8d0e2f" \
  -H "Content-Type: application/json" \
  -d '{
    "amountEgp": 150.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1042"
  }'
```

#### Poll Checkout Status

```bash
curl -X GET "https://your-domain.com/api/v1/checkout/status?sessionId=cmt_8f1b2c3d4e5f6a7b8c9d0e1f" \
  -H "Authorization: Bearer egp_live_9a7b3c2d1e0f8a4b6c8d0e2f"
```

#### Simulate Inbound Webhook Locally

```bash
TIMESTAMP=$(date +%s)
SECRET="whsec_e8f2a1b9c3d4e5f6a7b8c9d0"
PAYLOAD='{"event":"payment.confirmed","clientId":"client_1","businessName":"Test Store","transaction":{"sessionId":"cmt_test","amountEgp":150.00,"status":"CONFIRMED","detectedRef":"REF12345"}}'

# Compute HMAC-SHA256 signature
SIG=$(echo -n "${TIMESTAMP}.${PAYLOAD}" | openssl dgst -sha256 -hmac "${SECRET}" | sed 's/^.* //')

# Dispatch test webhook
curl -X POST "http://localhost:3000/api/webhooks/instapay" \
  -H "Content-Type: application/json" \
  -H "X-Instapay-Timestamp: ${TIMESTAMP}" \
  -H "X-Instapay-Signature: v1=${SIG}" \
  -H "X-Instapay-Event-Id: evt_test_123" \
  -d "${PAYLOAD}"
```

---

## 6. Error Handling & Lifecycle Status Matrix

### Transaction Lifecycle Statuses

| Status | Meaning | Can Transition To |
| :--- | :--- | :--- |
| `PENDING` | Session active; awaiting receipt detection. | `CONFIRMED`, `UNDERPAID`, `OVERPAID`, `EXPIRED`, `REJECTED` |
| `CONFIRMED` | Exact amount successfully received & verified. | *Terminal state* |
| `UNDERPAID` | Customer transferred less than `amountEgp`. | `CONFIRMED` (upon manual merchant review/settlement) |
| `OVERPAID` | Customer transferred more than `amountEgp`. | `CONFIRMED` |
| `EXPIRED` | TTL elapsed without matching transfer. | *Terminal state* |
| `REJECTED` | Manually rejected during review. | *Terminal state* |

### Common HTTP Status Codes

| Code | Status | Cause & Solution |
| :---: | :--- | :--- |
| **`200`** | OK | Request succeeded. |
| **`201`** | Created | Checkout session generated successfully. |
| **`400`** | Bad Request | Validation error (e.g. invalid `amountEgp`, expired timestamp). Check response `error` message. |
| **`401`** | Unauthorized | Missing or invalid API key (`Authorization: Bearer ...`) or webhook HMAC signature mismatch. |
| **`403`** | Forbidden | Merchant account is pending approval or disabled. |
| **`404`** | Not Found | `sessionId` does not exist or belongs to another merchant. |
| **`429`** | Rate Limit | Too many requests within rate-limit window. Slow down requests. |
| **`500`** | Server Error | Internal gateway issue. Handled with automatic retry. |

---

## 7. Production Readiness Checklist

Before deploying your integration live, verify each item on this checklist:

- [ ] **HTTPS Enforced:** All checkout endpoints and your webhook URL are served over valid TLS 1.3/HTTPS.
- [ ] **Webhook Raw Body:** Webhook signature verification uses the unparsed byte buffer rather than parsed/re-serialized JSON.
- [ ] **Anti-Replay Window:** Enforce the 5-minute (300 seconds) timestamp tolerance check.
- [ ] **Timing-Safe Comparison:** Signatures are compared using constant-time string comparison (`crypto.timingSafeEqual`, `hmac.compare_digest`, or `hash_equals`).
- [ ] **Idempotent Webhook Handler:** Your order fulfillment logic checks whether `transaction.sessionId` has already been processed to prevent double-fulfillment.
- [ ] **HTTP 200 Acknowledgment:** Your webhook handler returns HTTP 200 within 10 seconds before initiating heavy asynchronous processing.
- [ ] **Fallback Polling:** If your customer remains on the hosted checkout page, use fallback status polling via `GET /api/v1/checkout/status` as a secondary redundancy layer.
- [ ] **Credentials Stored in Environment Variables:** API Keys and Webhook Secrets are stored in secure environment secrets (`.env`), never committed to version control.
