# Authentication & Authorization Architecture

This document defines the security boundaries for the gateway. Authentication answers *who or what is calling*; authorization decides *which resources and state transitions that principal may access*.

## Principals and trust boundaries

| Principal | Credential | Permitted boundary |
| --- | --- | --- |
| Merchant browser | Opaque merchant session in an HttpOnly cookie | That merchant's dashboard data and ordinary checkout review actions |
| Merchant Android app | Revocable merchant bearer session plus a separate detector token | That merchant's mobile dashboard actions; detector token is limited to payment ingestion |
| Merchant API integration | Merchant API key in an exact `Authorization: Bearer` header | Create and inspect that merchant's checkout sessions |
| Detector device | Detector token in an exact `Authorization: Bearer` header | Submit deduplicated payment observations for ordinary checkouts paid to that merchant |
| Owner browser | Opaque owner session in an HttpOnly cookie | Platform administration |
| Owner Android app | Explicitly requested owner bearer session | Platform administration |
| Public payer | Unpredictable checkout session capability | Read and update only the minimum public checkout state for that session |

Browser merchant and owner sessions use different cookies and different HTTP clients. They are never stored in `localStorage`. Native clients must explicitly request bearer-token transport.

## Session lifecycle

- Login creates a random opaque token. Only its peppered hash is stored in `AuthSession`.
- Merchant sessions expire after seven days; owner sessions expire after twelve hours.
- Logout revokes the current session. A merchant password reset and account approval-state changes revoke all merchant sessions.
- A maximum of ten active sessions is retained per principal.
- Owner sessions carry a fingerprint of the current administrator password and TOTP secret, so rotating either credential invalidates existing sessions.
- Browser cookies are `HttpOnly`, `SameSite=Strict`, and `Secure` outside development/test.
- Unsafe cookie-authenticated requests must pass the trusted Origin/Referer check. Bearer clients are not subject to browser CSRF checks.
- The owner portal has a distinct `ADMIN_URL`. Every browser request to `/api/admin`, including reads, must originate from that exact URL; the merchant site cannot use an owner cookie to read or change administrative data. Owner Android clients continue to use explicit bearer tokens.
- Legacy signed sessions are rejected by default and can only be enabled explicitly in local development with `AUTH_ACCEPT_LEGACY_SESSIONS=true`.

## Account authentication

- Merchant registration requires a consumed `MERCHANT_SIGNUP` email OTP.
- Login and password-reset OTPs are single-use, expire, have bounded attempts, and are consumed with an atomic conditional update.
- Issuing a replacement OTP invalidates older outstanding codes for the same email and purpose.
- Passwords must be 12–128 UTF-8 bytes and are stored with salted scrypt hashes.
- Merchant authentication succeeds only when `approvalStatus` is exactly `APPROVED` and the account is active.
- Outside development/test, owner login requires the configured administrator email, password, and an RFC 6238 TOTP secret containing at least 160 bits.
- Development bypasses and OTP exposure require explicit flags and are refused outside local runtimes.

## Authorization policy

All merchant-owned database access is constrained by the authenticated `clientId`. A caller-supplied tenant ID is never used as authority.

Payment state changes follow these rules:

1. A merchant may manually confirm or reject only its own ordinary `CHECKOUT` transaction in an explicit exception/review state.
2. A merchant cannot confirm a pending payment, a platform `SUBSCRIPTION`, or a bundle purchase.
3. A detector can match only ordinary checkout payments whose recipient equals its merchant's registered InstaPay handle.
4. Subscription and bundle entitlements are granted only through the owner-authorized settlement service.
5. State transitions are conditional and atomic, so stale or repeated requests cannot replay a settlement.
6. Each detector observation is recorded in `IncomingPaymentEvent` under a unique event key before matching. Repeated observations are rejected as duplicates.
7. The free trial is claimed once through the immutable `trialRedeemedAt` marker.

Socket.IO merchant rooms are derived from the verified session. Public checkout rooms remain capability-based, are checked for existence, and are limited per connection. Payment events are not broadcast globally.

## Secret handling

- `OWNER_SECRET`, `TOKEN_PEPPER`, and `CREDENTIAL_ENCRYPTION_KEY` must be independent, random values of at least 32 characters. The encryption key protects credentials at rest; `TOKEN_PEPPER` protects credential hashes.
- Query-string credentials are not accepted.
- Request logs use the path rather than the full query URL.
- Login/session responses are marked `Cache-Control: no-store` and browser logins do not return reusable bearer tokens.
- API keys and detector tokens are authenticated through peppered hashes. Existing plaintext columns remain temporarily for the authenticated settings/recovery workflow; migrate them to one-time-reveal credential records before treating database disclosure as out of scope.

## Deployment checklist

Apply the additive Prisma schema before deploying the server:

```bash
npm run db:generate
npm run db:migrate
```

Configure the following for every non-local environment:

- unique `OWNER_SECRET`, `TOKEN_PEPPER`, and `CREDENTIAL_ENCRYPTION_KEY` values generated with a cryptographic random generator;
- strong `ADMIN_PASSWORD`, exact `ADMIN_EMAIL`, and Base32 `ADMIN_TOTP_SECRET`;
- an HTTPS `CLIENT_URL`;
- a distinct HTTPS `ADMIN_URL` such as `https://admin.example.com` (not a path on the merchant site); configure `VITE_ADMIN_URL` to the same value and `VITE_API_BASE_URL=https://api.example.com` in the static-site build;
- `TRUST_PROXY` set to the exact number of trusted reverse-proxy hops;
- Node.js 22.20+ and all tracked Prisma migrations applied before the API starts;
- Supabase `DATABASE_URL` and `DIRECT_URL` copied from its Connect panel, never exposed to the client;
- Upstash `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` set as host secrets for shared rate limiting;
- all development authentication flags left `false`;
- an email provider for OTP delivery;
- HTTPS webhook policy appropriate for production.

NilePay Android apps are maintained under `mobile/`. Release builds require external signing properties (`NILEPAY_RELEASE_KEYSTORE_FILE`, `NILEPAY_RELEASE_KEYSTORE_PASSWORD`, `NILEPAY_RELEASE_KEY_ALIAS`, and `NILEPAY_RELEASE_KEY_PASSWORD`). The configured API base URL is HTTPS. See `mobile/PLAY_RELEASE_READINESS.md` for production distribution requirements.

The retired detector/admin applications and their download endpoints have been removed. The API no longer distributes those APKs; deploy verified, signed NilePay builds through the intended distribution channel.

## MonsterASP deployment

Use MonsterASP's Git deployment with **Node.js SSR app** for the API. It builds
on the Windows host and generates the API IIS configuration; set the start
command to `npm start`. For the merchant and admin sites, use **Build Node.js
SPA**, publish the `dist` output, and retain the generated `web.config` copied
from `public/` for client-side routing and security headers.

Configure each host with the same registrable domain (`app.example.com`,
`admin.example.com`, and `api.example.com`) so strict browser cookies remain
same-site. Point ordinary uptime monitoring to `/api/health`; use
`/api/health/ready` for delivery readiness monitoring. Before production,
confirm the host supports Node.js 22.20+, persistent/always-on Node processes,
outbound Supabase/Upstash/SMTP traffic, and Socket.IO WebSocket upgrades. Run
`prisma migrate deploy` from CI or a trusted workstation before the API starts.

## Verification

Run the focused policy/authentication tests plus both TypeScript builds:

```bash
npm run test:auth
npm run typecheck
npm run server:build
npm run build
```

The local end-to-end suites are `npm run local:test` and `npx tsx local-deploy/test-portals.ts` after starting the local stack.
