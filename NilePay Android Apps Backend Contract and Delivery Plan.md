# NilePay Android Apps: Backend Contract and Delivery Plan

Oct 14, 2026 · @mohammed

## Summary

The server needs four additions before the new apps are built: refresh tokens, a revocable credential per detector device, account deletion, and (optionally) push. Without them the detector stops authenticating after 7 days and the admin app logs out every 12 hours. Play will also reject any app that lets users create an account but not delete it.

This replaces the earlier plan. Backend work is now a gate: the Android apps are built against the contract below, not the other way round. Reviewed against `origin/main` 57adaa0; nothing in the repo has been changed.

**Decisions needed from you**

- Brand name and package names (for example `com.nilepay.merchant`, `com.nilepay.admin`). A package name cannot change after the first upload.
- Developer account type, personal or organization. A personal account created after Nov 13, 2023 needs a closed test with 12 testers for 14 days.
- Whether the Admin app goes on the public store or only to private distribution. This plan assumes private.
- Retention period for transactions and audit records after account deletion.
- Whether push (Firebase) is in scope for the first release, or polling only.
- Sunset date for the old detect-token login.

## Backend contract

All new mobile routes live under `/api/mobile` or `/api/auth/mobile`, use bearer tokens only (no cookies), and sit behind the existing `generalApiLimiter` plus the route-specific limiters named below. The old `/api/auth/apk-login` keeps working until the sunset date.

| Route | Purpose | Notes |
| --- | --- | --- |
| `POST /api/auth/mobile/login` | Email, password and OTP login for the detector app. Returns access token, refresh token and expiry times. | Same OTP rules as `apk-login`. Does not return the detect token. |
| `POST /api/auth/mobile/refresh` | Exchange a refresh token for a new pair. | Rotating: each refresh token works once. Reuse of an old one revokes the whole session family. Limited per device and IP. |
| `POST /api/auth/mobile/logout` | Revoke the current session family. | Never blocked by origin or rate checks, like web logout. |
| `POST /api/mobile/devices/enroll` | Create a detector device and return its device token once. | Needs a valid access token. Device token is stored hashed. |
| `GET /api/mobile/devices` | List the merchant's devices with last seen time and status. | Also shown in the web portal Settings so a lost phone can be revoked. |
| `DELETE /api/mobile/devices/:id` | Revoke one device. | Takes effect on the next ingestion call. |
| `POST /api/mobile/devices/:id/push-token` | Store a Firebase token for this device. | Optional, only if push is in scope. |
| `DELETE /api/account` | Merchant account deletion. | Needs password and a fresh OTP. See retention below. |
| `GET /api/mobile/config` | Minimum supported app version and a kill-switch message. | Lets the server force an update without a store release. |

**Token lifetimes**

- Detector access token 30 minutes; refresh token 30 days, rotating.
- Admin access token 15 minutes; refresh capped so the session never outlives the existing 12 hour owner session. The admin TOTP stays in the `x-admin-totp` header for sensitive actions, as the web admin does today.

**Detector ingestion**

`POST /api/webhooks/instapay` accepts a device token (`Authorization: Bearer`) in addition to the legacy detect token. The app sends a stable `eventId` created once per notification and reused on every retry, so the existing replay protection in the matcher deduplicates. A revoked device receives 401 and the app shows a re-enrol screen.

**Account deletion**

The request revokes all sessions and devices immediately, disables the API key and detect token, cancels pending webhook deliveries, and anonymises personal fields (name, email, phone, profile image, WhatsApp number). Transaction, settlement and audit records are kept for the retention period you choose, with the merchant identifier replaced. A public web page at a fixed URL explains the process and offers a request form for users who no longer have the app, as Play requires.

**Push (optional)**

Firebase Cloud Messaging through the HTTP v1 API with a service account held only in the API environment. Messages are data-only and contain no payer or amount, only an event type and ID; the app fetches details over the authenticated API. Polling stays as the fallback, so push can never be the only path for a confirmed payment.

## Schema changes

All changes are additive migrations, run with `npm run db:migrate` before the API starts, as for the profile-image migration. The existing `DetectorDevice` table (unique on `clientId` and `deviceId`, already written by the heartbeat route) is extended rather than replaced.

| Table | Change | Reason |
| --- | --- | --- |
| `AuthSession` | Add `refreshTokenHash`, `refreshExpiresAt`, `familyId`, `rotatedAt`, `deviceId` (nullable). Index on `familyId` and `refreshTokenHash`. | Rotating refresh tokens with reuse detection. |
| `DetectorDevice` | Add `credentialHash` (unique, nullable), `revokedAt`, `name`, `pushToken`, `pushTokenUpdatedAt`. | Per-device credential that can be revoked on its own. |
| `Client` | Add `deletionRequestedAt`, `deletedAt`. | Track deletion and keep anonymised records. |
| `AppConfig` or env | Minimum app versions per app. | Force-update switch. |

Open point: I did not check whether Android bearer sessions already appear in `GET /api/settings/sessions`, which lists `AuthSession` rows of kind `MERCHANT`. The new tests must cover that, so a merchant can revoke a lost phone from the web portal.

## Security and tests for the backend work

Each new route ships with tests in `test:auth`, and the backend gate closes only when all of these pass in CI against a real Postgres.

- Refresh rotation: an old refresh token is rejected, and its reuse revokes every session in the family.
- Refresh and enrol routes are rate limited per device and IP, and the limiter fails closed in production like the existing ones.
- Tokens and device credentials are stored only as peppered hashes; plaintext appears once in a response and never in logs.
- A revoked device or session gets 401 on its next call, including ingestion.
- Ingestion with a device token and with the legacy detect token both work until the sunset date; after it, the legacy path returns 401 for app versions that support device tokens.
- Replaying the same `eventId` from a device creates one transaction.
- Account deletion requires password and a fresh OTP, is rate limited, and leaves no personal fields in the merchant row, session rows or webhook logs.
- Admin bearer sessions never exceed 12 hours in total, and sensitive actions still require the TOTP step-up.
- The existing browser flows (cookie sessions, CORS, `requireTrustedOrigin`, `requireAdminOrigin`) are unchanged; add regression tests that prove it.
- Open items from the last review still apply and should be closed in the same window: branch protection on `main`, the Upstash limiter key collision, the in-memory TOTP replay map, and the profile image returned on every session call.

## Updated delivery plan

Backend and design run first, in parallel; both apps start only after the backend gate closes, and Play review comes last. Timings are my estimates for one or two engineers, not measurements.

&#91;embedded content: delivery roadmap · 6 phases, 3 gates\]

Gate 1 is the one most likely to slip, because it needs refresh tokens, device credentials and account deletion tested in CI, not just written. The detector and admin apps overlap by about three weeks, so a second engineer shortens the plan; a single engineer should expect the upper end.

## Play Console readiness checklist

Nothing here guarantees approval. The detector reads another app's notifications, and that is the part a reviewer is most likely to question.

- [ ] Both apps target API 36 and are built as signed `.aab` files with Play App Signing.
- [ ] New brand name, icon and listing text that do not use the InstaPay name or logo as the app's own identity.
- [ ] In-app disclosure screen shown before the redirect to Notification access, stating what is read, why, and what is sent to the server.
- [ ] Parser reads only the payment line from the one monitored app; every other notification is dropped without being stored or sent.
- [ ] Privacy policy URL, covering notification content, device identifiers, IP address and retention.
- [ ] Data safety form completed to match what the app and server actually collect.
- [ ] Financial features declaration completed (required of every app).
- [ ] Account deletion in the app and at a public web URL.
- [ ] Foreground service declaration only if a foreground service remains; battery-optimization exemption removed unless the current policy allows it for this use.
- [ ] App access section filled with an approved test merchant and a way to receive the OTP during review.
- [ ] Release lint, accessibility checks (48 dp targets, contrast, TalkBack labels) and a clean Pre-launch report.
- [ ] Tested on real devices from Android 8 to 16, in English and Arabic (RTL).
- [ ] Closed test with 12 or more testers for 14 days if the account is personal.
- [ ] Debug APKs and any signing keys removed from git; signing key stored outside the repo.

## Unverified items and open questions

- I could not check Google's current wording on notification-listener access, the battery-optimization exemption, or foreground service declarations. Read the live policy text before building those screens.
- I did not confirm whether organization accounts must also run the 14-day closed test.
- Not confirmed: whether MonsterASP allows outbound calls to Google's Firebase and OAuth hosts, supports WebSockets, and keeps the process alive for the webhook worker.
- Not confirmed: that `runasp.net` staging hosts share a cookie site. This affects only the web portals, not the mobile apps, but production needs one custom domain.
- Typecheck, builds and the `checkoutService` tests have not run here, because the npm registry is unreachable.
- Timings in the delivery plan are my estimates for one or two engineers, not measurements.
- Legal retention rules for payment records in Egypt are not researched here; get advice before choosing the retention period.

Sources: [Target API level requirements](https://developer.android.com/google/play/requirements/target-sdk), [Play testing requirements for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [Financial features declaration](https://support.google.com/googleplay/android-developer/answer/13849271?hl=en)
