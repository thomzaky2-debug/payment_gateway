import nodemailer from 'nodemailer'
import crypto from 'crypto'
import { getOwnerSecret } from '../services/authService.js'

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
  if (verification.purpose !== purpose || verification.otpHash !== expectedOtpHash) {
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

  // Mark OTP as consumed
  await db.emailVerification
    .update({
      where: { id: verification.id },
      data: { consumedAt: new Date() },
    })
    .catch(() => {})

  return { valid: true }
}

function getFromAddress(): string {
  return process.env.EMAIL_FROM || process.env.SMTP_USER || 'InstaPay Gateway <no-reply@instapay-gateway.local>'
}

async function sendViaResend(input: SendOtpEmailInput): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getFromAddress(),
        to: input.to,
        subject: `Your InstaPay Gateway verification code: ${input.otp}`,
        html: renderOtpHtml(input.otp, input.purpose),
        text: renderOtpText(input.otp, input.purpose),
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
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    })

    await transporter.sendMail({
      from: getFromAddress(),
      to: input.to,
      subject: `Your InstaPay Gateway verification code: ${input.otp}`,
      html: renderOtpHtml(input.otp, input.purpose),
      text: renderOtpText(input.otp, input.purpose),
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

  // 3. Fallback / Dev / Test logging
  console.info(`\n======================================================`)
  console.info(`📧 [EMAIL OTP DISPATCH]`)
  console.info(`To: ${input.to}`)
  console.info(`Code: ${input.otp}`)
  console.info(`Purpose: ${input.purpose || 'Verification'}`)
  console.info(`======================================================\n`)
}

function renderOtpText(otp: string, purpose?: string): string {
  return [
    `InstaPay Payment Gateway Verification`,
    ``,
    `Your verification code is: ${otp}`,
    ``,
    `This code will expire in 10 minutes. If you did not request this code, please ignore this email.`,
  ].join('\n')
}

function renderOtpHtml(otp: string, purpose?: string): string {
  const title = purpose === 'MERCHANT_LOGIN' ? 'Merchant Sign-In Code' : 'Merchant Verification Code'
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f19; color: #f1f5f9; padding: 40px 20px; margin: 0;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 36px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
    <div style="text-align: center; margin-bottom: 28px;">
      <div style="display: inline-block; padding: 10px 18px; background: linear-gradient(135deg, #7c3aed, #4f46e5); border-radius: 12px; font-weight: 800; font-size: 18px; color: #ffffff; letter-spacing: 0.5px;">
        InstaPay Gateway
      </div>
      <h2 style="font-size: 22px; font-weight: 700; margin: 20px 0 6px; color: #ffffff;">${title}</h2>
      <p style="font-size: 14px; color: #94a3b8; margin: 0;">Use the single-use 6-digit passcode below to proceed.</p>
    </div>

    <div style="background-color: #1e293b; border: 1px solid rgba(124, 58, 237, 0.3); border-radius: 14px; padding: 22px; text-align: center; margin-bottom: 24px;">
      <div style="letter-spacing: 12px; font-size: 38px; font-weight: 900; color: #38bdf8; font-family: monospace; padding-left: 12px;">
        ${otp}
      </div>
    </div>

    <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0 0 16px;">
      ⏱️ This code is valid for <strong>10 minutes</strong> and can only be used once. Never share this code with anyone.
    </p>

    <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
      If you did not request this verification, you can safely disregard this email.
    </div>
  </div>
</body>
</html>`
}

export interface SendApprovalEmailInput {
  to: string
  businessName: string
  apiKeyPrefix?: string
}

export async function sendMerchantApprovalEmail(input: SendApprovalEmailInput): Promise<void> {
  const cleanEmail = normalizeEmail(input.to)
  const subject = `🎉 Your InstaPay Gateway Account has been Approved!`
  const text = [
    `Congratulations! Your merchant account for "${input.businessName}" has been approved.`,
    ``,
    `Your live integration tokens (API Key, Webhook Signing Secret, and Companion Detector Token) are active and ready.`,
    `You can now access your merchant dashboard and Developer Portal to integrate and start accepting payments.`,
    ``,
    `Login to your dashboard: ${process.env.APP_URL || 'https://gateway.local'}`,
  ].join('\n')

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Account Approved</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0b0f19; color: #f1f5f9; padding: 40px 20px; margin: 0;">
  <div style="max-width: 540px; margin: 0 auto; background-color: #111827; border: 1px solid rgba(255,255,255,0.1); border-radius: 20px; padding: 36px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
    <div style="text-align: center; margin-bottom: 24px;">
      <div style="display: inline-block; padding: 10px 18px; background: linear-gradient(135deg, #059669, #10b981); border-radius: 12px; font-weight: 800; font-size: 18px; color: #ffffff;">
        InstaPay Gateway
      </div>
      <h2 style="font-size: 22px; font-weight: 800; margin: 20px 0 6px; color: #34d399;">🎉 Account Approved!</h2>
      <p style="font-size: 14px; color: #94a3b8; margin: 0;">Congratulations, <strong>${input.businessName}</strong>!</p>
    </div>

    <div style="background-color: #162033; border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 14px; padding: 20px; margin-bottom: 24px;">
      <p style="font-size: 13.5px; color: #e2e8f0; line-height: 1.6; margin: 0 0 12px;">
        Your merchant gateway application has been reviewed and <strong>approved</strong> by our team. All your integration tokens have been automatically generated:
      </p>
      <ul style="font-size: 13px; color: #94a3b8; padding-left: 20px; margin: 0; line-height: 1.8;">
        <li><strong style="color: #f8fafc;">Live API Key:</strong> Ready for checkout session creation</li>
        <li><strong style="color: #f8fafc;">Companion Token:</strong> Ready for the Android Detector APK</li>
        <li><strong style="color: #f8fafc;">Webhook Secret:</strong> Ready for HMAC-SHA256 signature verification</li>
      </ul>
      ${input.apiKeyPrefix ? `<div style="margin-top: 12px; font-size: 12px; color: #38bdf8; font-family: monospace;">Key Prefix: ${input.apiKeyPrefix}</div>` : ''}
    </div>

    <p style="font-size: 13px; color: #94a3b8; line-height: 1.6; margin: 0 0 20px;">
      Log in to your merchant dashboard to view your complete API credentials in the <strong>Developer Portal</strong>.
    </p>

    <div style="border-top: 1px solid rgba(255,255,255,0.08); padding-top: 20px; font-size: 12px; color: #64748b; text-align: center;">
      Thank you for choosing InstaPay Payment Gateway. If you have any integration questions, check our Developer Documentation.
    </div>
  </div>
</body>
</html>`

  // 1. Try Resend
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: getFromAddress(), to: cleanEmail, subject, html, text }),
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
      const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass } })
      await transporter.sendMail({ from: getFromAddress(), to: cleanEmail, subject, html, text })
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

