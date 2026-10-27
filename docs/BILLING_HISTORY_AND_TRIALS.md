# Merchant billing and trial history

- Plans & Billing includes paginated plan and bundle orders, with checkout price snapshots, order references, dates, and payment status. Pending orders are not successful payments. Free trial activation is shown separately using the durable redemption timestamp.
- `GET /api/subscription/history?page=1` requires an approved merchant session, returns only that merchant's subscription orders, and disables caching. Pages contain 25 orders. Bundles are included once via their subscription payment transaction.
- Trial activation uses an atomic conditional update against `trialRedeemedAt`, subscription state, and eligibility. Simultaneous requests cannot grant the trial twice or reset quota. Admin trial assignment uses the same conditions. The one-time rule applies per merchant account.
- Trial duration edits apply to future first activations. Existing trial deadlines are not extended or revived by editing the plan. Transaction limits remain admin configurable.
- Manual Review → Late / Expired includes the latest 100 unpaid expired checkouts as read-only records. They are separate from actionable review cases and cannot be confirmed without a detected payment. Paid late/expired cases retain their review actions.

Publish the API, merchant website, and admin website to enable these changes on the hosted sites. This change requires no new database migration.
