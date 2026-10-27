# Public privacy and support

Admin sidebar → **Privacy & Support** manages public contacts, operator name,
and an optional plain-text replacement privacy policy. Empty policy text uses
the built-in policy with the current operator and support email. Editing the
policy does not change backend retention behavior. Saving is admin-only,
rate-limited, and audited. Public endpoints never expose private settings.

Default contacts:

- Email: nilepay.customers@gmail.com
- WhatsApp: +201114671033 (local 01114671033)
- Facebook: NilePay — https://www.facebook.com/share/19n4Woi3U9

Merchant login/registration and dashboard footers link to Privacy Policy,
Support (`/#support/`), and account deletion. Support is available without
login. Public details are loaded on opening/reloading the page; there is no
forced browser refresh. The APK's server-hosted policy/deletion pages also
use the saved settings; the APK's offline notice is not remotely rewritten.

## Deployment order

1. Back up the database following your existing deployment procedure.
2. Run `npm run db:migrate` to apply `20261027100000_public_site_settings`.
3. Build and publish the API, merchant frontend, and admin frontend.
4. Open admin → Privacy & Support, verify defaults and save.
5. From a signed-out browser verify Support, privacy and deletion pages.

No production migration is run by the implementation task. Prisma client
generation and tests do not apply this table to your hosted database.
