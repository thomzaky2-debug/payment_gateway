import { isValidTotpSecret } from './lib/totp.js'
import { parseTrustProxy } from './lib/proxyTrust.js'

const INSECURE_MARKERS = [
  'changeme',
  'change-me',
  'example',
  'dev-insecure',
  'password123',
  'replace-with',
  'your-secret',
]

function requireSecret(name: string, minLength: number): string {
  const value = process.env[name]?.trim()
  if (!value || value.length < minLength) {
    throw new Error(`${name} must be configured with at least ${minLength} characters`)
  }
  const lower = value.toLowerCase()
  const isLocalRuntime = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  if (!isLocalRuntime && INSECURE_MARKERS.some((marker) => lower.includes(marker))) {
    throw new Error(`${name} contains a known placeholder and must be replaced`)
  }
  return value
}

function requireHttpsOrigin(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} must be configured outside local development`)

  try {
    const url = new URL(value)
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    ) {
      throw new Error('invalid origin')
    }
    return url.origin
  } catch {
    throw new Error(`${name} must be an HTTPS origin without a path, query, or fragment outside local development`)
  }
}

/** Validate security-sensitive configuration before opening the HTTP port. */
export function validateRuntimeConfig() {
  const ownerSecret = requireSecret('OWNER_SECRET', 32)
  const tokenPepper = requireSecret('TOKEN_PEPPER', 32)
  requireSecret('ADMIN_PASSWORD', 12)

  if (ownerSecret === tokenPepper) {
    throw new Error('OWNER_SECRET and TOKEN_PEPPER must be different values')
  }

  const isLocalRuntime = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
  if (!isLocalRuntime) {
    if (process.env.AUTH_ALLOW_DEV_BYPASS === 'true' || process.env.AUTH_EXPOSE_DEV_OTP === 'true') {
      throw new Error('Development authentication bypasses cannot be enabled outside local development')
    }

    const clientOrigin = requireHttpsOrigin('CLIENT_URL')
    const adminOrigin = requireHttpsOrigin('ADMIN_URL')
    if (clientOrigin === adminOrigin) {
      throw new Error('ADMIN_URL must be a different origin from CLIENT_URL')
    }
    // Keep the encryption key separate from the token hashing pepper. Existing
    // credentials encrypted with TOKEN_PEPPER remain decryptable during this
    // migration, but all new credential encryption uses this explicit key.
    requireSecret('CREDENTIAL_ENCRYPTION_KEY', 32)
    if (!process.env.ADMIN_EMAIL?.includes('@')) {
      throw new Error('ADMIN_EMAIL must be configured outside local development')
    }
    const totpSecret = requireSecret('ADMIN_TOTP_SECRET', 32)
    if (!isValidTotpSecret(totpSecret, 20)) {
      throw new Error('ADMIN_TOTP_SECRET must be a valid Base32 secret with at least 160 bits')
    }

    const hasResend = Boolean(process.env.RESEND_API_KEY?.trim())
    const smtpFields = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'] as const
    const configuredSmtpFields = smtpFields.filter((name) => Boolean(process.env[name]?.trim()))
    if (!hasResend && configuredSmtpFields.length !== smtpFields.length) {
      throw new Error('Configure RESEND_API_KEY or complete SMTP_HOST, SMTP_USER, and SMTP_PASS for OTP email delivery')
    }

    if (!process.env.UPSTASH_REDIS_REST_URL?.startsWith('https://') || !process.env.UPSTASH_REDIS_REST_TOKEN?.trim()) {
      throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured for hosted rate limiting')
    }

    // Make the client-IP trust boundary explicit. Use 0/false for a direct
    // deployment, true/1 only behind one known reverse proxy hop.
    parseTrustProxy(process.env.TRUST_PROXY, true)
  }

  // Validate ACCOUNT_RECORD_RETENTION_DAYS whenever it is set (local or production).
  const rawRetention = process.env.ACCOUNT_RECORD_RETENTION_DAYS
  if (rawRetention !== undefined && rawRetention !== '') {
    const parsed = parseInt(rawRetention, 10)
    if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== rawRetention.trim()) {
      throw new Error(
        `ACCOUNT_RECORD_RETENTION_DAYS must be a positive integer (got "${rawRetention}")`
      )
    }
  }
}
