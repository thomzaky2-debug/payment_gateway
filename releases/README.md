# Android APKs

These APKs are built against the live NilePay API at `https://nilepay-api.runasp.net`.

- `nilepay-merchant-release.apk` is the signed v1.3.2 release build of the NilePay Merchant application, with a Play Store-style search header, tabs, horizontal sections, and dark/light themes (also published on the merchant portal at `/releases/nilepay-merchant.apk`).
- `nilepay-detector-live-debug.apk` is the debug-signed merchant detector application.
- `nilepay-admin-live-debug.apk` is the debug-signed administrator application.

Merchant v1.3.2 adds responsive section sizing, readable payment cards, bounded scrolling receipts, payment ID copying, sorting and Cairo-date filters on loaded results, CSV export of shown results, daily summary sharing, and live detector diagnostics with retry feedback.

Version 1.3.2 retains compact layouts and reduces card padding, metric heights, shortcut sizes, and payment row spacing.

Version 1.3.2 simplifies Detector to readiness, last detection, and pending uploads. Setup actions appear only when needed; advanced checks remain under troubleshooting. Payment filters collapse by default, exports use a compact action, mixed-direction dates render correctly in Arabic, and changing sections dismisses the search keyboard.

## NilePay Admin v1.4.0

`nilepay-admin-release.apk` (`com.nilepay.admin`, Android 8.0+) contains the versioned admin website UI and uses the live HTTPS API with the existing admin login and permissions. It preserves the website's responsive layout and light/dark themes. UI updates require rebuilding this APK; website deployments use the same source component.

The new Controls workspace provides merchant access/session controls and expiry/quota filters, payment inspection/search/filtering, selection and CSV export of shown records, webhook retry/review access, audit search, delivery health, optional refresh, and plan/quota and notification shortcuts. Native CSV export uses the system file picker.

Original admin navigation and sign-in were verified on a Huawei DUB-LX1 (Android 8.1); phone-only layout fixes stack Merchant Details panels and correct search-icon spacing. Administrative changes are not submitted as part of live preview testing.

Admin v1.2.0 validation: full TypeScript check, 5 admin filtering/export tests, 9 Android tests, Android lint, and release build passed. Signed-in device checks confirmed live records, health, payment inspection/back navigation, and the CSV save picker (canceled without saving). New Controls UI is bundled in the APK; the hosted website needs its normal deployment to show the shared source changes.

Admin v1.2.1 moves the section heading, icon, and sync badge above the Controls workspace and all record cards.

Admin v1.3.0 adds a compact notification center: local recipient search (50 visible results), active approved audiences, templates, character limits, preview and audience confirmation, private saved drafts, interrupted-send recovery, and the latest 25 broadcasts. The server adds 500-recipient transactional batches, durable request deduplication, strict audience validation, atomic audit logging, and best-effort live inbox events. Deploy the updated API to enable these server capabilities; the APK falls back to legacy audit history and requires manual review before retrying uncertain sends against an older API. Notifications are delivered to merchant portal inboxes, not Android push notifications.

Admin v1.4.0 redesigns Plans & Pricing with compact light/dark cards, separate subscription/bundle/private-offer/trial/usage views, local search/filter/sort, 24-record incremental rendering, comparison of up to three plans, a single-cycle capacity estimator, shown-record CSV export, quota/expiry filters, hidden bundle duplication, and offer templates. Pricing edits validate inputs and confirm the commercial terms before submission. Unchanged promotions retain their exact deadline. Existing authenticated billing APIs power these controls; no billing data is changed by previews.
