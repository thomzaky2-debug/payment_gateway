# Android APKs

These APKs are built against the live NilePay API at `https://nilepay-api.runasp.net`.

- `nilepay-merchant-release.apk` is the signed v1.3.2 release build of the NilePay Merchant application, with a Play Store-style search header, tabs, horizontal sections, and dark/light themes (also published on the merchant portal at `/releases/nilepay-merchant.apk`).
- `nilepay-detector-live-debug.apk` is the debug-signed merchant detector application.
- `nilepay-admin-live-debug.apk` is the debug-signed administrator application.

Merchant v1.3.2 adds responsive section sizing, readable payment cards, bounded scrolling receipts, payment ID copying, sorting and Cairo-date filters on loaded results, CSV export of shown results, daily summary sharing, and live detector diagnostics with retry feedback.

Version 1.3.2 retains compact layouts and reduces card padding, metric heights, shortcut sizes, and payment row spacing.

Version 1.3.2 simplifies Detector to readiness, last detection, and pending uploads. Setup actions appear only when needed; advanced checks remain under troubleshooting. Payment filters collapse by default, exports use a compact action, mixed-direction dates render correctly in Arabic, and changing sections dismisses the search keyboard.
