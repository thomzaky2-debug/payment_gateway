# NilePay brand assets

The merchant and admin websites use `/brand/nilepay-mark.png` with the NilePay name. The transparent mark retains its blue/teal colors in either theme; a navy backing gives it contrast at small sizes. The browser favicon and Apple touch icon use the same mark. `/brand/nilepay-wordmark.png` is available for light backgrounds.

The Compose apps share `NilePayLogo` from `:designsystem`. It appears in the merchant sign-in screen and shared top bar. The admin release landing screen uses it too; the debug admin app continues to open the component gallery. This branding change does not add admin app functionality.

Both `mobile/merchant` and `mobile/admin` have adaptive launcher icons with transparent, padded foregrounds and a navy background, plus density-specific PNG fallbacks. These are the maintained Android applications. Application IDs, authentication, notification detection, and permissions are unchanged.

Source artwork: `branding/nilepay-v1/nilepay-wordmark.png`, generated for NilePay. The deployment assets extract the N monogram and resize it with Lanczos resampling. The original generated files are retained. Do not substitute the older unrelated `branding/NilePay_Dark_Mode_Logo.png`.

## Publish

1. Build the websites with `npm run client:build`, then publish the merchant and admin sites. No database migration or API deployment is required for these branding changes.
2. In `mobile/`, run `./gradlew :merchant:assembleDebug :admin:assembleDebug` for testing. Use the existing signed release workflow for store or production distribution.
3. Install the rebuilt NilePay APK. An installed APK cannot receive launcher assets from a website deployment. A launcher may retain its icon cache briefly after an update.
