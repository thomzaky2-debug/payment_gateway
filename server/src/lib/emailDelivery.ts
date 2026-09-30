import nodemailer from 'nodemailer'
import crypto from 'crypto'

export interface SendOtpEmailInput {
  to: string
  otp: string
  purpose?: string
}

export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim()
}

export function hashOtp(email: string, otp: string): string {
  const secret = process.env.OWNER_SECRET || process.env.JWT_SECRET || 'instapay-secure-otp-secret-key-2026'
  return crypto.createHmac('sha256', secret).update(`${normalizeEmail(email)}:${otp}`).digest('hex')
}

export function generateOtp(): string {
  return crypto.randomInt(100000, 1000000).toString()
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
