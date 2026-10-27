# NilePay Merchant: publication handoff

The app is not yet approved or ready for production submission. Debug installation and passing lint do not establish Play policy compliance.

## Implemented controls

- Versioned, explicit notification disclosure; rejecting it returns to sign-in.
- Listener checks consent before reading notification text. Upload and heartbeat workers also check consent. Sign-out clears consent.
- Disclosure identifies background processing, parsed payment fields, device identifiers, and server transmission.
- Offline privacy/data-use notice is available before login and in Settings, with a link to the public API `/privacy` page. Support: `nilepay.customers@gmail.com`.
- APK Settings links to the existing email-verified `/account-deletion` flow. No app install or login is required on the public deletion page.
- Daily cleanup removes eligible successful webhook logs after 90 days and audit logs after 365 days. Unresolved deliveries are excluded. Existing deleted-account payment retention defaults to 1825 days after deletion.
- Release packaging requires explicit signing credentials; no debug-key fallback.
- Branded adaptive launcher icon; API target 36.

## Operator decisions required before publication

1. Operator: **Premium Service**. Privacy/support: **nilepay.customers@gmail.com**. Supply the actual hosting/database backup and infrastructure log schedules. Review the five-year deleted-account payment retention with your local adviser: it is an operational default, not a verified statutory mandate.
2. Deploy the API to publish `https://nilepay-api.runasp.net/privacy` and update the deletion-page text. Verify both pages without login before adding the privacy URL and `https://nilepay-api.runasp.net/account-deletion` to Play Console. Rebuild the APK for the new links.
3. Verify the public deletion flow with a dedicated disposable test account, including email delivery, cancellation window, eventual scrubbing, and revoked credentials. The daily worker must stay running. Do not test by deleting a real merchant account. Retained data is pseudonymized, not necessarily irreversibly anonymized.
4. Complete Data safety and financial-features declarations based on actual functionality. Review merchant email/account data, payment information, sender handles, device identifiers, diagnostics, and third-party processors. Do not claim “no collection.”
5. Provide reviewers with a dedicated test merchant and reliable OTP access instructions. Never include production credentials in the repository or listing.
6. Complete content rating, target audience, ads declaration, support details, screenshots, and store graphics. Describe NilePay as an independent merchant tool without implying InstaPay or Google endorsement.
7. Verify Play Console developer identity/account requirements and required closed testing. Eligible new personal accounts require 12 testers opted in continuously for 14 days before applying for production access.
8. Check billing rules against any subscription purchase or upgrade paths, including linked web pages. Review financial-service regional requirements against the actual business model.
9. Run Play pre-launch reports and verify notification consent, logout, offline replay, large fonts, Arabic RTL, Android 13+ notifications, and API 36 devices. Verify 16 KB page-size compatibility for all packaged native libraries.

## Build and upload

Keep signing credentials outside Git. Configure all four values using protected environment variables or untracked Gradle properties:

- `NILEPAY_RELEASE_KEYSTORE_FILE`
- `NILEPAY_RELEASE_KEYSTORE_PASSWORD`
- `NILEPAY_RELEASE_KEY_ALIAS`
- `NILEPAY_RELEASE_KEY_PASSWORD`

From `mobile`, run `./gradlew :merchant:bundleRelease`. Upload the signed AAB from `merchant/build/outputs/bundle/release/` through Play Console and configure Play App Signing. Check the signing certificate; do not use the Android debug certificate. Increment versionCode for each subsequent upload. Use `:merchant:assembleDebug` for local testing.

## Official references

- https://support.google.com/googleplay/android-developer/answer/10144311
- https://support.google.com/googleplay/android-developer/answer/13327111
- https://support.google.com/googleplay/android-developer/answer/13849271
- https://support.google.com/googleplay/android-developer/answer/9842756
- https://support.google.com/googleplay/android-developer/answer/14151465
