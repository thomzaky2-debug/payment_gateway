# NilePay Mobile (Android)

Multi-module Android implementation for the NilePay platform, built with **Jetpack Compose**, **Material 3**, **Single-Activity Architecture**, **Hilt**, and **Kotlin Coroutines**.

## Applications & Modules

- **NilePay Merchant (`:merchant`)**: Package `com.nilepay.merchant`. Merchant operations, transaction monitoring, and automated InstaPay payment detection.
- **NilePay Admin (`:admin`)**: Package `com.nilepay.admin`. Private distribution app for platform administrators. It packages the admin website at its real HTTPS origin, preserving the website screens, themes, responsive layout, and live API permissions.
- **Design System (`:designsystem`)**: Design tokens (color, type, spacing, shape), UI components, bundled Inter & Noto Sans Arabic fonts (OFL licensed), RTL support, and screenshot tests.
- **Core (`:core`)**: Android Keystore encrypted token storage, single-flight refresh authenticator against `POST /api/auth/mobile/refresh`, device binding with hardware-agnostic UUID, HTTPS enforcement, and typed HTTP error model.

---

## Prerequisites

- **JDK**: Java 17 (set `JAVA_HOME`)
- **Android SDK**: `compileSdk = 36`, `targetSdk = 36`, `minSdk = 26` (Android 8.0+)
- **Build Tools**: `36.0.0` or `35.0.0`

---

## Build & Test Commands

Run all commands from the `mobile/` directory:

### 1. Build Debug APKs
```bash
./gradlew :merchant:assembleDebug :admin:assembleDebug
```
Output APKs:
- `mobile/merchant/build/outputs/apk/debug/merchant-debug.apk`
- `mobile/admin/build/outputs/apk/debug/admin-debug.apk`

### 2. Build Release APKs (R8 Minification & Resource Shrinking)
```bash
./gradlew :merchant:assembleRelease :admin:assembleRelease
```
Output APKs:
- `mobile/merchant/build/outputs/apk/release/merchant-release-unsigned.apk`
- `mobile/admin/build/outputs/apk/release/admin-release-unsigned.apk`

### 3. Run Android Lint
```bash
./gradlew lintDebug
```

### 4. Run All Unit & Network Tests
```bash
./gradlew testDebugUnitTest
```
Runs unit tests for `:core` and `:designsystem` using MockWebServer and Robolectric.

### 5. Component Gallery & Screenshot Tests (Roborazzi)

Record baseline screenshots:
```bash
./gradlew :designsystem:recordRoborazziDebug
```

Verify screenshots against baseline:
```bash
./gradlew :designsystem:verifyRoborazziDebug
```

---

## Running the Component Gallery on Device / Emulator

In `debug` builds, launching either application automatically opens the **NilePay Component Gallery Screen**, which allows interactive testing in:
- **Light & Dark modes** (toggleable at top bar)
- **English & Arabic locales** (toggleable at top bar with full RTL layout)

### Install & Launch NilePay Merchant Gallery
```bash
./gradlew :merchant:installDebug
adb shell am start -n com.nilepay.merchant.debug/com.nilepay.merchant.MainActivity
```

### Install & Launch NilePay Admin Gallery
```bash
./gradlew :admin:installDebug
adb shell am start -n com.nilepay.admin.debug/com.nilepay.admin.MainActivity
```

---

## Release Signing Configuration

Release signing credentials must **never** be checked into version control. Configure them via Gradle properties (`~/.gradle/gradle.properties`) or CI environment variables:

```properties
NILEPAY_RELEASE_KEYSTORE_FILE=/path/to/release.keystore
NILEPAY_RELEASE_KEYSTORE_PASSWORD=keystore_password
NILEPAY_RELEASE_KEY_ALIAS=release_key_alias
NILEPAY_RELEASE_KEY_PASSWORD=key_password
```

If these properties are omitted, local release builds fall back to the local debug keystore for verification purposes.

## NilePay Admin release

Run `npm ci` in the repository root (Node 22), then build `./gradlew :admin:assembleRelease` from `mobile/` and use `admin/build/outputs/apk/release/admin-release.apk`.
The launcher opens the versioned admin UI compiled from `src/admin-main.tsx` into APK assets and served at the admin HTTPS origin. API requests continue to use the live API. Sign in with the existing admin email, password, and authenticator code; no credentials are bundled. The interface supplies Controls, Overview, Merchants, Merchant Details, Transactions, Audit Trail, Webhook Logs, Plans & Pricing, Notifications, and Privacy & Support, including its light/dark themes and mobile drawer.

An internet connection is required. Failed page loads show a retry screen. Android Back navigates browser history or closes the app at the root. External links open in their appropriate app. Authentication cookies remain in Android's private WebView storage; native backup is disabled. Debug builds load the same portal and enable WebView inspection; release builds disable inspection. Rebuild the APK for UI updates. The same Controls component is also included in the normal website source and becomes available there when that website is deployed.

Verification: `./gradlew :admin:testDebugUnitTest :admin:lintDebug :admin:assembleRelease`. Authenticated admin actions require a live account and must be checked after signing in on a device.

Admin v1.1.1 was checked after live sign-in on a Huawei DUB-LX1 (Android 8.1): all nine navigation sections loaded. A bundled, phone-only CSS patch fixes the Merchant Details grid and search-field icon spacing while preserving the portal design. Six admin tests, lint, and the release build passed.

## Admin v1.2.0 controls

Controls includes loaded-record search, merchant status/expiry/quota filters, payment date/amount/status filters, sorting, selection, CSV exports, payment inspection, merchant access/session controls, delivery retry/review links, audit search, delivery health, optional 30-second refresh, and links to existing plan/quota and notification forms. Admin mutations retain server authentication and existing review/MFA enforcement; new access/session actions require explicit confirmation. CSV exports exclude credential fields and neutralize spreadsheet formula prefixes. On Android, exporting opens the system save picker; on the website it downloads a CSV. Filters and exports explicitly apply to the loaded API snapshot.

Gradle's `bundleAdminPortal` task runs `scripts/build-admin-apk-ui.mjs` before builds. Generated assets are ignored by Git. Run `npm run admin:typecheck`, `npm run admin:test`, and the Android checks above. Mobile CI installs Node dependencies before Gradle.

## Admin v1.3.0 notifications

The notification center renders at most 50 searched recipients and 25 recent broadcasts, with deferred local search and no background polling. It supports templates, strict length checks, audience confirmation, preview, private device drafts, and interrupted-send recovery. Send operations are never retried automatically. Backend support in `adminNotificationService.ts` uses 500-recipient pages in one transaction and deterministic request IDs for duplicate protection; audit rows commit with notifications. Deploy the updated API to enable duplicate-safe retries, active-approved recipient enforcement, dedicated history, and live merchant inbox events. Older APIs use audit-history fallback and manual reconciliation for uncertain sends. Inbox persistence does not confirm that a merchant read the notification and does not provide native APK push.

## Admin v1.4.0 Plans & Pricing

Pricing has five focused views with responsive dark/light layouts, catalog search, status filters, sorting, CSV exports, three-plan comparison, a single-cycle capacity estimator, hidden bundle copies, reusable private-offer templates, and merchant quota/expiry filters. Results render 24 at a time. Pricing dialogs support Android Back, focus trapping, input validation, and concrete confirmation before writes; unchanged promotion deadlines are preserved. All operations use existing billing APIs. Trial duration changes apply to future activations, while quota changes update existing trial merchants without extending their deadlines. Hosted website changes require the normal frontend deployment; APK UI is bundled.
