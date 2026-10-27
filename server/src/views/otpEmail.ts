const FONT = "Arial, Helvetica, sans-serif"

function copyFor(purpose?: string) {
  const deletion = purpose === 'ACCOUNT_DELETION' || purpose === 'ACCOUNT_DELETION_PUBLIC'
  return {
    title: deletion ? 'Confirm account deletion' : purpose === 'PASSWORD_RESET' ? 'Reset your password' : purpose === 'MERCHANT_SIGNUP' ? 'Verify your email' : purpose === 'MERCHANT_LOGIN' ? 'Sign in to NilePay' : 'Verify your request',
    intro: deletion ? 'You requested to delete your NilePay account. Enter this code on the account deletion page to confirm your request.'
      : purpose === 'PASSWORD_RESET' ? 'Use this code on the NilePay password reset page to choose a new password.'
        : purpose === 'MERCHANT_SIGNUP' ? 'Welcome to NilePay. Enter this code to verify your email and continue creating your merchant account.'
          : purpose === 'MERCHANT_LOGIN' ? 'Enter this code on the NilePay sign-in screen to securely access your merchant account.'
            : 'Enter this code in NilePay to verify your request.',
    minutes: purpose === 'ACCOUNT_DELETION_PUBLIC' ? 30 : 10,
    deletion,
  }
}

export function otpEmailSubject(purpose?: string): string {
  return `${copyFor(purpose).title} | NilePay`
}

function validateCode(otp: string) {
  if (typeof otp !== 'string' || otp.length !== 6 || !/^\d{6}$/.test(otp)) throw new Error('OTP email requires a six-digit code')
}

export function renderOtpText(otp: string, purpose?: string): string {
  validateCode(otp)
  const copy = copyFor(purpose)
  return [
    'NilePay — Merchant Gateway', '', copy.title, '', copy.intro, '',
    `Your verification code: ${otp}`, `Expires in ${copy.minutes} minutes. This code can only be used once.`, '',
    'Never share this code. NilePay support will never ask for your verification code or password.',
    copy.deletion ? 'If you did not request account deletion, do not enter or share this code. This email alone does not confirm deletion.' : 'If you did not request this code, you can ignore this email.', '',
    'Need help? nilepay.customers@gmail.com', 'Support: https://nilepay.runasp.net/#support/',
  ].join('\n')
}

/** Inline styles and presentation tables keep the message usable in email clients. */
export function renderOtpHtml(otp: string, purpose?: string): string {
  validateCode(otp)
  const copy = copyFor(purpose)
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no">
  <title>${copy.title} | NilePay</title>
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table, td { mso-table-lspace:0pt; mso-table-rspace:0pt; }
    table { border-spacing:0; }
    @media only screen and (max-width:480px) {
      .email-outer { padding:20px 12px !important; }
      .email-content { padding:26px 22px !important; }
      .email-heading { font-size:23px !important; line-height:31px !important; }
      .email-code { font-size:32px !important; letter-spacing:6px !important; }
      .email-footer { padding:0 22px 26px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#f1f5f9;font-family:${FONT};color:#0f172a;">
  <div style="display:none;font-size:1px;line-height:1px;color:#f1f5f9;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${copy.title}. Your single-use code expires in ${copy.minutes} minutes.</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f1f5f9">
    <tr><td class="email-outer" align="center" style="padding:40px 16px;">
      <!--[if mso]><table role="presentation" width="560" align="center"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #dbe4ee;border-radius:20px;overflow:hidden;">
        <tr><td style="height:4px;font-size:0;line-height:4px;background-color:#2563eb;">&nbsp;</td></tr>
        <tr><td class="email-content" bgcolor="#081426" style="padding:28px 32px;background-color:#081426;border-radius:18px 18px 0 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td width="44" valign="middle" style="width:44px;padding-right:12px;"><img src="https://nilepay.runasp.net/brand/nilepay-mark.png" width="36" height="36" alt="" border="0" style="display:block;width:36px;height:36px;"></td>
            <td valign="middle" style="font-family:${FONT};"><span style="font-size:23px;line-height:28px;font-weight:700;color:#ffffff;">NilePay</span><br><span style="font-size:12px;line-height:20px;color:#a9bdd4;">Merchant Gateway</span></td>
          </tr></table>
        </td></tr>
        <tr><td class="email-content" style="padding:32px 32px 28px;font-family:${FONT};">
          <p style="margin:0 0 10px;font-size:11px;line-height:18px;font-weight:700;letter-spacing:1.4px;color:#2563eb;">ACCOUNT VERIFICATION</p>
          <h1 class="email-heading" style="margin:0 0 14px;font-family:${FONT};font-size:26px;line-height:34px;font-weight:700;color:#0f172a;">${copy.title}</h1>
          <p style="margin:0 0 26px;font-size:16px;line-height:26px;color:#475569;">${copy.intro}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;">
            <tr><td align="center" style="padding:22px 12px 24px;">
              <p style="margin:0 0 12px;font-family:${FONT};font-size:11px;line-height:18px;font-weight:700;letter-spacing:1px;color:#475569;">YOUR VERIFICATION CODE</p>
              <div class="email-code" dir="ltr" style="font-family:'Courier New',Courier,monospace;font-size:36px;line-height:46px;letter-spacing:8px;font-weight:700;color:#1d4ed8;white-space:nowrap;">${otp}</div>
              <p style="margin:12px 0 0;font-family:${FONT};font-size:13px;line-height:20px;color:#475569;">Valid for <strong style="color:#1d4ed8;">${copy.minutes} minutes</strong> &middot; One use only</p>
            </td></tr>
          </table>
          <p style="margin:24px 0 0;font-size:14px;line-height:23px;color:#334155;"><strong>Keep this code private.</strong> NilePay support will never ask for your verification code or password.</p>
          <p style="margin:12px 0 0;font-size:14px;line-height:23px;color:#64748b;">${copy.deletion ? 'If you did not request account deletion, do not enter or share this code. This email alone does not confirm deletion.' : 'If you did not request this code, you can safely ignore this email.'}</p>
        </td></tr>
        <tr><td class="email-footer" style="padding:0 32px 28px;font-family:${FONT};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #e2e8f0;">
            <tr><td style="padding-top:22px;font-size:13px;line-height:22px;color:#64748b;">Need a hand? <a href="https://nilepay.runasp.net/#support/" style="color:#2563eb;text-decoration:underline;">Contact support</a><br><a href="mailto:nilepay.customers@gmail.com" style="color:#475569;text-decoration:none;">nilepay.customers@gmail.com</a></td></tr>
          </table>
        </td></tr>
      </table>
      <p style="max-width:520px;margin:20px 8px 0;font-family:${FONT};font-size:12px;line-height:20px;text-align:center;color:#64748b;">NilePay &middot; Premium Service<br>This is an account verification email, not a payment receipt.</p>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>`
}
