# InstaPay Payment Gateway & Dashboard

A production-ready, full-stack payment gateway ecosystem for Egyptian merchants utilizing InstaPay. Integrates automated Android notification receipt detection, hosted customer checkout pages, a modular merchant dashboard, real-time WebSocket payment confirmation, HMAC-SHA256 signed webhooks with automated retries, and companion Android apps.

---

## 🏛️ Architecture & Refactored Highlights

This codebase brings together the refined modular React dashboard UI with a production-grade backend engine, resolving the architectural flaws and technical debt of legacy monoliths:

1. **Eliminated "God File" Monoliths**:
   - Replaced bloated 2,500-line single-file pages with modular, focused components (`pages/`, `components/`, and clean hooks).
2. **Decoupled Service Layer**:
   - All critical domain logic extracted into dedicated, testable service modules:
     - `server/src/services/matcherService.ts`: Core InstaPay notification matching algorithm with 3 fallbacks, handle normalization, grace periods, and underpayment/overpayment handling.
     - `server/src/services/webhookService.ts`: HMAC-SHA256 signature generation (`X-Instapay-Signature`, `X-Instapay-Timestamp`, `X-Instapay-Event-Id`) and payload dispatching.
     - `server/src/services/checkoutService.ts`: Hosted checkout session lifecycle and deep-link generation.
     - `server/src/services/notificationService.ts`: Real-time Socket.IO room broadcaster (`checkout:<sessionId>`).
     - `server/src/services/authService.ts`: Scrypt password hashing with constant-time verification and peppered token hashing.
3. **Automated Background Webhook Retry Worker**:
   - `server/src/workers/webhookRetryWorker.ts` actively polls `WebhookLog` every 30 seconds for failed deliveries, executing automatic retries with exponential backoff (1m, 5m, 15m, 1h, 6h).
4. **Unified Single PostgreSQL / Supabase Schema**:
   - Consolidated into a single `prisma/schema.prisma` targeting Supabase PostgreSQL (supporting both connection poolers and direct migration URLs).
5. **High Financial Precision**:
   - Integer cents (`amountCents`) stored alongside EGP floats to prevent JavaScript floating-point rounding errors.

The principal model, session lifecycle, payment authorization rules, and production checklist are documented in [Authentication & Authorization Architecture](docs/AUTHENTICATION_AUTHORIZATION.md).

---

## 🔄 High-Level Payment & Matching Lifecycle

```text
Customer / E-Commerce Checkout
  │
  │ 1. POST /api/v1/checkout/create (with merchant apiKey)
  ▼
Gateway Server (Port 3001)
  │
  │ 2. Creates PENDING Transaction & returns hosted URL (/pay/:sessionId)
  ▼
Customer Hosted Checkout Screen (/pay/:sessionId)
  │
  │ 3. Joins Socket.IO room `checkout:<sessionId>` & displays InstaPay details / QR
  ▼
Customer pays via Official InstaPay App
  │
  │ 4. Customer transfers exact EGP amount to merchant's InstaPay handle
  ▼
Merchant Android Phone (Receiving Device)
  │
  │ 5. Official InstaPay app posts "Received Payment" push notification
  ▼
Detector APK (NotificationListenerService)
  │
  │ 6. Regex parses amount and sender handle, POSTs /api/webhooks/instapay (detectToken)
  ▼
Gateway Matcher Service
  │
  │ 7. Matches PENDING transaction idempotently; updates status to CONFIRMED
  ├──▶ 8. Socket.IO emits `checkout:update` -> Customer screen immediately flips green!
  └──▶ 9. Webhook Service sends HMAC-SHA256 signed callback to merchant backend
```

---

## 📦 Project Layout

| Directory / File | Description |
| :--- | :--- |
| `src/` | Modular React 18 + Vite frontend dashboard and customer hosted checkout page |
| `src/pages/CheckoutPayPage.tsx` | Customer-facing hosted checkout with live countdown and Socket.IO real-time confirmation |
| `src/services/api.ts` | Centralized frontend API client |
| `server/src/` | Express + TypeScript API server & WebSocket engine |
| `server/src/services/` | Decoupled domain services (`matcherService`, `webhookService`, `checkoutService`, etc.) |
| `server/src/workers/` | Automated background webhook retry worker |
| `prisma/schema.prisma` | Unified PostgreSQL schema for Supabase |
| `android/app/` | Native Kotlin Merchant Detector APK source code (`com.instapaydetector.app`) |
| `android/admin/` | Native Kotlin Admin Mobile App source code (`com.instapaydetector.admin`) |
| `apks/` | Legacy APK artifacts; downloads stay disabled until replaced with current release-signed builds |

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- **Node.js 20+**
- **npm**
- A **Supabase** project (or local PostgreSQL database)

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Fill in your Supabase connection strings:
```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
OWNER_SECRET="generate-with-openssl-rand-hex-32"
TOKEN_PEPPER="generate-with-openssl-rand-hex-32"
```

### 3. Generate Database Client & Seed Plans
```bash
npm run db:generate
npm run db:push
npm run db:seed
```

### 4. Start Development Servers
Run both backend API (port 3001) and Vite frontend (port 3000) concurrently:
```bash
npm run dev
```
- Dashboard UI: `http://localhost:3000`
- Backend API & WebSockets: `http://localhost:3001`
- Customer Checkout: `http://localhost:3000/pay/:sessionId`

---

## 📲 Android Companion APK Setup

1. Configure the release gateway URL and external signing credentials described in [Authentication & Authorization Architecture](docs/AUTHENTICATION_AUTHORIZATION.md).
2. Build and verify the current Detector release APK; do not distribute the legacy checked-in artifact.
3. Install the verified APK and sign in with your merchant email, password, and OTP.
4. When prompted, grant **Notification Listener Permission** in Android settings.
5. In your device's battery settings, set background activity to **Unrestricted** (prevents aggressive OEM task killers from stopping the listener).

---

## 📡 Merchant Checkout API

### Create a Checkout
```bash
curl -X POST http://localhost:3001/api/v1/checkout/create \
  -H "Authorization: Bearer <MERCHANT_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{
    "amountEgp": 150.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1042"
  }'
```

**Response:**
```json
{
  "ok": true,
  "checkout": {
    "sessionId": "cmt_8f2a1b9c...",
    "status": "PENDING",
    "amountEgp": 150,
    "currency": "EGP",
    "deepLinkUrl": "https://ipn.eg/S/merchant/instapay/TOKEN",
    "checkoutUrl": "http://localhost:3000/pay/cmt_8f2a1b9c...",
    "expiresAt": "2026-09-29T14:45:00.000Z"
  }
}
```

### Check Checkout Status
```bash
curl http://localhost:3001/api/v1/checkout/status?sessionId=cmt_8f2a1b9c... \
  -H "Authorization: Bearer <MERCHANT_API_KEY>"
```

---

## 🔐 Webhook Signature Verification

When a payment is confirmed, the gateway sends a signed POST request to your `webhookUrl`:

**Headers:**
```http
X-Instapay-Event-Id: evt_8f12a...
X-Instapay-Timestamp: 1727612345
X-Instapay-Signature-Version: v1
X-Instapay-Signature: v1=3f8a2c1b...
```

**Node.js Verification Example:**
```javascript
const crypto = require('crypto');

function verifyWebhook(rawBody, signatureHeader, timestamp, webhookSecret) {
  const baseString = `${timestamp}.${rawBody}`;
  const expected = 'v1=' + crypto.createHmac('sha256', webhookSecret).update(baseString).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
}
```
