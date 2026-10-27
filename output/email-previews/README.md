# OTP email previews

These HTML, text and PNG files use a sample code for design review. They are not sent emails and the sample code does not authenticate an account.

The server template is `server/src/views/otpEmail.ts` and is used by both SMTP and Resend delivery. It covers sign-in, signup, password reset and both deletion flows. Existing code lifetimes remain unchanged (10 minutes, or 30 for public deletion).

Typography: Arial/Helvetica system fonts; 16px body with 26px line height, 26px desktop heading (23px mobile), 36px desktop code (32px mobile), 13–14px explanatory text and 12px outer footer. The code remains contiguous and selectable. Layout uses inline styles and presentation tables, with a 560px maximum width and a plain-text alternative.

Browser previews were checked at 320, 390 and 800px, including blocked images. These checks do not substitute for testing actual Gmail/Outlook mailbox rendering.

Publish the API to update email content. The optional logo image uses the merchant website's `/brand/nilepay-mark.png`, so include the merchant branding assets in the website deployment. The NilePay name and full code remain visible when images are unavailable.
