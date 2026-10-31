import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { getOwnerSecret } from '../services/authService.js'
import { otpEmailSubject, renderOtpHtml, renderOtpText } from '../views/otpEmail.js'

export interface SendOtpEmailInput {
  to: string
  otp: string
  purpose?: string
}

export interface VerifyOtpResult {
  valid: boolean
  error?: string
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

export function hashOtp(email: string, otp: string): string {
  const secret = getOwnerSecret()
  return crypto.createHmac('sha256', secret).update(`${normalizeEmail(email)}:${otp}`).digest('hex')
}

export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString()
}

/**
 * Centralized OTP verification helper.
 * Eliminates duplicated verification logic across register/login/apk-login/password-reset.
 *
 * @param db          Prisma client instance
 * @param email       Normalized email to verify against
 * @param verificationId  The verification record ID
 * @param otp         The OTP code submitted by the user
 * @param purpose     Expected purpose (MERCHANT_SIGNUP | MERCHANT_LOGIN | PASSWORD_RESET)
 * @returns           { valid: true } or { valid: false, error: string }
 */
export async function verifyOtpCode(
  db: any,
  email: string,
  verificationId: string,
  otp: string,
  purpose: string,
): Promise<VerifyOtpResult> {
  const cleanEmail = normalizeEmail(email)
  const cleanId = String(verificationId).trim()
  const cleanOtp = String(otp).trim()

  const verification = await db.emailVerification.findUnique({
    where: { id: cleanId },
  })

  if (!verification || verification.email !== cleanEmail) {
    return { valid: false, error: 'Please request a new verification code.' }
  }

  if (verification.consumedAt) {
    return { valid: false, error: 'This verification code has already been used. Please request a new code.' }
  }

  if (verification.expiresAt.getTime() <= Date.now()) {
    return { valid: false, error: 'Verification code has expired. Please request a new code.' }
  }

  if (verification.attempts >= 5) {
    return { valid: false, error: 'Too many failed attempts. This code is locked. Please request a new code.' }
  }

  const expectedOtpHash = hashOtp(cleanEmail, cleanOtp)
  const otpMatches = (() => {
    try {
      const actual = Buffer.from(verification.otpHash, 'hex')
      const expected = Buffer.from(expectedOtpHash, 'hex')
      return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
    } catch {
      return false
    }
  })()

  if (verification.purpose !== purpose || !otpMatches) {
    const nextAttempts = verification.attempts + 1
    await db.emailVerification
      .update({
        where: { id: verification.id },
        data: { attempts: { increment: 1 } },
      })
      .catch(() => {})

    const remaining = Math.max(0, 5 - nextAttempts)
    if (remaining === 0) {
      return { valid: false, error: 'Incorrect verification code. Maximum attempts reached. Please request a new code.' }
    }
    return { valid: false, error: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` }
  }

  // Atomic conditional consumption prevents concurrent replay of a valid code.
  const consumed = await db.emailVerification.updateMany({
    where: {
      id: verification.id,
      email: cleanEmail,
      purpose,
      otpHash: expectedOtpHash,
      consumedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: 5 },
    },
    data: { consumedAt: new Date() },
  })

  if (consumed.count !== 1) {
    return { valid: false, error: 'This verification code is no longer valid. Please request a new code.' }
  }

  return { valid: true }
}

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).trim()
}

function extractEmailDomain(raw: string): string {
  const email = extractEmailAddress(raw)
  const atIndex = email.lastIndexOf('@')
  return atIndex !== -1 ? email.slice(atIndex + 1).toLowerCase() : 'gmail.com'
}

function getFromAddress(smtpUser?: string): string {
  const raw = (process.env.EMAIL_FROM || smtpUser || process.env.SMTP_USER || 'nilepay.customers@gmail.com').trim()
  // When authenticating via Gmail SMTP, aligning the From address with SMTP_USER prevents DMARC/SPF misalignment spam flags
  if (smtpUser && smtpUser.includes('@')) {
    const rawAddr = extractEmailAddress(raw).toLowerCase()
    const userAddr = extractEmailAddress(smtpUser).toLowerCase()
    if (rawAddr !== userAddr && userAddr.endsWith('@gmail.com')) {
      return `NilePay <${userAddr}>`
    }
  }
  if (raw.includes('<') && raw.includes('>')) {
    return raw
  }
  return `NilePay <${raw}>`
}

function buildMessageId(fromHeader: string): string {
  const domain = extractEmailDomain(fromHeader)
  return `<${crypto.randomUUID()}@${domain}>`
}

async function sendViaResend(input: SendOtpEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  try {
    const from = getFromAddress()
    const replyTo = extractEmailAddress(from)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: input.to,
        reply_to: replyTo,
        subject: otpEmailSubject(input.purpose),
        html: renderOtpHtml(input.otp, input.purpose),
        text: renderOtpText(input.otp, input.purpose),
        headers: {
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
          'Auto-Submitted': 'auto-generated',
        },
      }),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.warn(`[email-otp] Resend delivery warning: ${response.status} ${errText}`)
      return false
    }

    return true
  } catch (err) {
    console.warn('[email-otp] Resend error:', err)
    return false
  }
}

async function sendViaSmtp(input: SendOtpEmailInput): Promise<boolean> {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return false

  try {
    const port = Number(process.env.SMTP_PORT || 465)
    const from = getFromAddress(user)
    const replyTo = extractEmailAddress(from)
    const domain = extractEmailDomain(from)
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      name: domain,
      auth: { user, pass },
    })

    await transporter.sendMail({
      from,
      to: input.to,
      replyTo,
      messageId: buildMessageId(from),
      subject: otpEmailSubject(input.purpose),
      html: renderOtpHtml(input.otp, input.purpose),
      text: renderOtpText(input.otp, input.purpose),
      headers: {
        'X-Auto-Response-Suppress': 'OOF, AutoReply',
        'Auto-Submitted': 'auto-generated',
      },
    })

    return true
  } catch (err) {
    console.warn('[email-otp] SMTP error:', err)
    return false
  }
}

export async function sendOtpEmail(input: SendOtpEmailInput): Promise<void> {
  // 1. Try Resend
  if (await sendViaResend(input)) {
    console.info(`[email-otp] Verification email sent to ${input.to} via Resend.`)
    return
  }

  // 2. Try SMTP
  if (await sendViaSmtp(input)) {
    console.info(`[email-otp] Verification email sent to ${input.to} via SMTP.`)
    return
  }

  if (process.env.NODE_ENV !== 'development' || process.env.AUTH_EXPOSE_DEV_OTP !== 'true') {
    throw new Error('No OTP email delivery provider is configured')
  }

  // Explicit local-development fallback only.
  console.info(`\n======================================================`)
  console.info(`📧 [EMAIL OTP DISPATCH]`)
  console.info(`To: ${input.to}`)
  console.info(`Code: ${input.otp}`)
  console.info(`Purpose: ${input.purpose || 'Verification'}`)
  console.info(`======================================================\n`)
}

export interface SendApprovalEmailInput {
  to: string
  businessName: string
  apiKeyPrefix?: string
}

export async function sendMerchantApprovalEmail(input: SendApprovalEmailInput): Promise<void> {
  const cleanEmail = normalizeEmail(input.to)
  const subject = `Your NilePay merchant account is ready - NilePay`
  const text = [
    `Hello,`,
    ``,
    `Your merchant account for "${input.businessName}" has been approved.`,
    ``,
    `Your live integration credentials (API Key, Webhook Signing Secret, and Companion Detector Token) are active and ready in your merchant dashboard.`,
    ``,
    `Best regards,`,
    `NilePay Support`,
    `nilepay.customers@gmail.com`,
  ].join('\n')

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Account Approved - NilePay</title></head>
<body style="margin:0;padding:24px 16px;background-color:#ffffff;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;">
    <tr>
      <td style="padding:28px 28px 24px;">
        <p style="margin:0 0 18px;font-size:15px;line-height:22px;font-weight:700;color:#0f172a;">NilePay</p>
        <h1 style="margin:0 0 12px;font-size:20px;line-height:28px;font-weight:700;color:#0f172a;">Your merchant account is ready</h1>
        <p style="margin:0 0 12px;font-size:16px;line-height:26px;color:#334155;">Hello,</p>
        <p style="margin:0 0 16px;font-size:16px;line-height:26px;color:#334155;">
          Your merchant gateway account for <strong>${input.businessName}</strong> has been reviewed and approved. Your integration credentials have been generated:
        </p>
        <ul style="font-size:14px;color:#334155;padding-left:20px;margin:0 0 18px;line-height:22px;">
          <li><strong>Live API Key:</strong> Ready for checkout session creation</li>
          <li><strong>Companion Token:</strong> Ready for the NilePay Merchant Android app</li>
          <li><strong>Webhook Secret:</strong> Ready for HMAC-SHA256 signature verification</li>
        </ul>
        ${input.apiKeyPrefix ? `<p style="margin:0 0 18px;font-size:13px;color:#475569;font-family:monospace;">Key prefix: ${input.apiKeyPrefix}</p>` : ''}
        <p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#475569;">
          Sign in to your merchant dashboard to view your API credentials in the Developer Portal.
        </p>
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

  // 1. Try Resend
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    try {
      const from = getFromAddress()
      const replyTo = extractEmailAddress(from)
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: cleanEmail,
          reply_to: replyTo,
          subject,
          html,
          text,
          headers: {
            'X-Auto-Response-Suppress': 'OOF, AutoReply',
            'Auto-Submitted': 'auto-generated',
          },
        }),
      })
      if (response.ok) {
        console.info(`[email] Approval notification sent to ${cleanEmail} via Resend.`)
        return
      }
    } catch {}
  }

  // 2. Try SMTP
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (host && user && pass) {
    try {
      const port = Number(process.env.SMTP_PORT || 465)
      const from = getFromAddress(user)
      const replyTo = extractEmailAddress(from)
      const domain = extractEmailDomain(from)
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        name: domain,
        auth: { user, pass },
      })
      await transporter.sendMail({
        from,
        to: cleanEmail,
        replyTo,
        messageId: buildMessageId(from),
        subject,
        html,
        text,
        headers: {
          'X-Auto-Response-Suppress': 'OOF, AutoReply',
          'Auto-Submitted': 'auto-generated',
        },
      })
      console.info(`[email] Approval notification sent to ${cleanEmail} via SMTP.`)
      return
    } catch {}
  }

  // 3. Fallback dev log
  console.info(`\n======================================================`)
  console.info(`🎉 [MERCHANT APPROVAL EMAIL DISPATCH]`)
  console.info(`To: ${cleanEmail}`)
  console.info(`Business: ${input.businessName}`)
  console.info(`Status: APPROVED (Integration Tokens Generated)`)
  console.info(`======================================================\n`)
}
