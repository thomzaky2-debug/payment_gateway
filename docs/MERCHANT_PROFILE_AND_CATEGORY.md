# Merchant settings, product categories and mobile profile

Settings sections are available directly in the merchant sidebar and by URL:

- `/#settings/profile`: business name, profile photo and receiving account summary.
- `/#settings/checkout`: Payment Link and checkout expiry.
- `/#settings/precision`: overpayment and underpayment rules.
- `/#settings/webhooks`: integrations and webhook configuration.
- `/#settings/notifications`: merchant inbox.

Existing General, Precision, Webhooks and Notifications links continue to work. Mobile has an in-page section selector as well as drawer links. Saving a section sends only that section's editable fields. Profile photo uploads/removal still save immediately.

The Checkout Simulator accepts an optional `productCategory` string (maximum 100 characters). It is trimmed and stored on `Transaction`, returned by checkout creation/status, displayed in transaction details and the customer checkout, and included in the confirmation webhook. Older records retain `null`. It does not affect the payment amount, bank matching, quota, or confirmation policy.

`GET /api/mobile/profile` requires an authenticated merchant and returns only the merchant ID, business name, email and uploaded profile photo. No integration credentials are returned. The APK fetches it on launch, resume and explicit refresh. Photos are decoded in the background, bounded to 512px, and shown as circular avatars in the app header and account card. Missing, removed or unsupported photos use initials. The app does not load arbitrary external image URLs.

## Deployment

Apply `20261027210000_add_product_category` with `npm run db:migrate` before publishing the API. Then publish the merchant website and install the rebuilt merchant APK. The new profile endpoint requires the updated API. The database migration is additive and does not change existing transactions.
