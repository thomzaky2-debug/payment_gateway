# NilePay Mobile (Android)

Multi-module Android implementation for the NilePay platform, built with **Jetpack Compose**, **Material 3**, **Single-Activity Architecture**, **Hilt**, and **Kotlin Coroutines**.

## Applications & Modules

- **NilePay Merchant (`:merchant`)**: Package `com.nilepay.merchant`. Merchant operations, transaction monitoring, and automated InstaPay payment detection.
- **NilePay Admin (`:admin`)**: Package `com.nilepay.admin`. Private distribution app for platform administrators.
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
