const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, Helvetica, sans-serif"

function copyFor(purpose?: string) {
  const deletion = purpose === 'ACCOUNT_DELETION' || purpose === 'ACCOUNT_DELETION_PUBLIC'
  return {
    title: deletion
      ? 'Confirm account deletion'
      : purpose === 'PASSWORD_RESET'
        ? 'Reset your password'
        : purpose === 'MERCHANT_SIGNUP'
          ? 'Verify your email'
          : purpose === 'MERCHANT_LOGIN'
            ? 'Sign in to NilePay'
            : 'Verify your request',
    intro: deletion
      ? 'You requested to delete your NilePay account. Enter this code on the account deletion page to confirm your request.'
      : purpose === 'PASSWORD_RESET'
        ? 'Use this code on the NilePay password reset page to choose a new password.'
        : purpose === 'MERCHANT_SIGNUP'
          ? 'Welcome to NilePay. Enter this code to verify your email and continue creating your merchant account.'
          : purpose === 'MERCHANT_LOGIN'
            ? 'Enter this code on the NilePay sign-in screen to securely access your merchant account.'
            : 'Enter this code in NilePay to verify your request.',
    minutes: purpose === 'ACCOUNT_DELETION_PUBLIC' ? 30 : 10,
    deletion,
  }
}

export function otpEmailSubject(purpose?: string): string {
  return `${copyFor(purpose).title} - NilePay`
}

function validateCode(otp: string) {
  if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
    throw new Error('OTP email requires a six-digit code')
  }
}

export function renderOtpText(otp: string, purpose?: string): string {
  validateCode(otp)
  const copy = copyFor(purpose)
  return [
    'Hello,',
    '',
    copy.title,
    copy.intro,
    '',
    `Verification code: ${otp}`,
    `This code is valid for ${copy.minutes} minutes and can only be used once.`,
    '',
    'Please keep this code private. NilePay support will never ask for your verification code or password.',
    copy.deletion
      ? 'If you did not request account deletion, do not enter or share this code. This email alone does not confirm deletion.'
      : 'If you did not request this code, you can safely ignore this email.',
    '',
    'Best regards,',
    'NilePay Support',
    'nilepay.customers@gmail.com',
  ].join('\n')
}

/**
 * Clean, lightweight transactional HTML layout designed for primary inbox delivery:
 * - No external tracking or cross-domain images
 * - No shared-hosting links that trigger anti-phishing heuristics
 * - High text-to-HTML ratio with natural greeting and sign-off
 */
export function renderOtpHtml(otp: string, purpose?: string): string {
  validateCode(otp)
  const copy = copyFor(purpose)
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
  <title>${copy.title} - NilePay</title>
</head>
<body style="margin:0;padding:24px 16px;background-color:#ffffff;font-family:${FONT};color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;">
    <tr>
      <td style="padding:28px 28px 24px;font-family:${FONT};">
        <p style="margin:0 0 18px;font-size:15px;line-height:22px;font-weight:700;color:#0f172a;">NilePay</p>
        <h1 style="margin:0 0 12px;font-family:${FONT};font-size:20px;line-height:28px;font-weight:700;color:#0f172a;">${copy.title}</h1>
        <p style="margin:0 0 12px;font-size:16px;line-height:26px;color:#334155;">Hello,</p>
        <p style="margin:0 0 20px;font-size:16px;line-height:26px;color:#334155;">${copy.intro}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;margin:0 0 20px;">
          <tr>
            <td style="padding:16px 20px;">
              <p style="margin:0 0 6px;font-size:13px;line-height:18px;color:#475569;">Verification code:</p>
              <div dir="ltr" style="font-family:'Courier New',Courier,monospace;font-size:28px;line-height:36px;letter-spacing:4px;font-weight:700;color:#0f172a;">${otp}</div>
              <p style="margin:8px 0 0;font-size:13px;line-height:18px;color:#64748b;">Valid for ${copy.minutes} minutes (one-time use)</p>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 10px;font-size:14px;line-height:22px;color:#334155;">Please keep this code private. NilePay support will never ask for your verification code or password.</p>
        <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#64748b;">${copy.deletion ? 'If you did not request account deletion, do not enter or share this code. This email alone does not confirm deletion.' : 'If you did not request this code, you can safely ignore this email.'}</p>
        <p style="margin:0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:13px;line-height:20px;color:#64748b;">
          Best regards,<br>
          <strong style="color:#334155;">NilePay Support</strong><br>
          <a href="mailto:nilepay.customers@gmail.com" style="color:#2563eb;text-decoration:none;">nilepay.customers@gmail.com</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
}
