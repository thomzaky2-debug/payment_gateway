import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const PREFIX = 'enc:v1:'

/**
 * Derives a 256-bit encryption key from environment secrets.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.CREDENTIAL_ENCRYPTION_KEY ||
    process.env.TOKEN_PEPPER ||
    process.env.SESSION_SECRET ||
    'instapay-credential-encryption-key-salt-2025'
  return crypto.createHash('sha256').update(secret).digest()
}

/**
 * Encrypts a sensitive credential at rest using AES-256-GCM authenticated encryption.
 * Output format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptCredential(plaintext: string | null | undefined): string | null {
  if (!plaintext || typeof plaintext !== 'string') return null
  if (plaintext.startsWith(PREFIX)) return plaintext // Already encrypted

  const iv = crypto.randomBytes(12)
  const key = getEncryptionKey()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  return `${PREFIX}${iv.toString('hex')}:${authTag}:${encrypted}`
}

/**
 * Decrypts an AES-256-GCM encrypted credential.
 * Transparently falls back to returning the raw string if not encrypted (backwards compatibility).
 */
export function decryptCredential(ciphertext: string | null | undefined): string | null {
  if (!ciphertext || typeof ciphertext !== 'string') return null
  if (!ciphertext.startsWith(PREFIX)) return ciphertext // Unencrypted fallback

  try {
    const raw = ciphertext.slice(PREFIX.length)
    const parts = raw.split(':')
    if (parts.length !== 3) return ciphertext

    const [ivHex, tagHex, dataHex] = parts
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(tagHex, 'hex')
    const key = getEncryptionKey()

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(dataHex, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    return decrypted
  } catch (err) {
    console.error('[credentialCrypto] Decryption failed:', err)
    return null
  }
}

/**
 * Checks whether a given string is encrypted at rest with the active envelope.
 */
export function isCredentialEncrypted(val: string | null | undefined): boolean {
  return typeof val === 'string' && val.startsWith(PREFIX)
}
