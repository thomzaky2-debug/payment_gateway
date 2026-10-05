import { isValidTotpSecret } from './lib/totp.js'

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

    const clientUrl = process.env.CLIENT_URL
    if (!clientUrl?.startsWith('https://')) {
      throw new Error('CLIENT_URL must use HTTPS outside local development')
    }
    if (!process.env.ADMIN_EMAIL?.includes('@')) {
      throw new Error('ADMIN_EMAIL must be configured outside local development')
    }
    const totpSecret = requireSecret('ADMIN_TOTP_SECRET', 32)
    if (!isValidTotpSecret(totpSecret, 20)) {
      throw new Error('ADMIN_TOTP_SECRET must be a valid Base32 secret with at least 160 bits')
    }
  }
}
