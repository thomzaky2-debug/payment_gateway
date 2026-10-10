import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const PREFIX = 'enc:v1:'

interface KeyDescriptor {
  id: string
  key: Buffer
}

/**
 * Derives a 256-bit encryption key with cryptographic domain separation.
 */
function deriveKeyFromSecret(secret: string): Buffer {
  return crypto
    .createHmac('sha256', secret)
    .update('instapay:credential:aes-256-gcm:v1')
    .digest()
}

/**
 * Derives legacy key for backward compatibility with commit 347ebf0.
 */
function deriveLegacyKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest()
}

function getKeyId(key: Buffer): string {
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 8)
}

/**
 * Resolves active encryption key.
 * Throws in production if no secret is configured.
 */
function getActiveKeyDescriptor(): KeyDescriptor {
  const explicitKey = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim()
  if (explicitKey) {
    const key = crypto.createHash('sha256').update(explicitKey).digest()
    return { id: getKeyId(key), key }
  }

  const primarySecret =
    process.env.TOKEN_PEPPER?.trim() ||
    process.env.SESSION_SECRET?.trim()

  if (!primarySecret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CREDENTIAL_ENCRYPTION_KEY or TOKEN_PEPPER must be configured for credential encryption in production'
      )
    }
    const devKey = deriveKeyFromSecret('dev-local-credential-pepper-key-only')
    return { id: getKeyId(devKey), key: devKey }
  }

  const key = deriveKeyFromSecret(primarySecret)
  return { id: getKeyId(key), key }
}

/**
 * Returns all candidate decryption keys (active key, legacy keys, and rotated previous keys).
 */
function getAllCandidateKeys(): KeyDescriptor[] {
  const candidates: KeyDescriptor[] = []
  try {
    candidates.push(getActiveKeyDescriptor())
  } catch {
    // If active key resolution fails in prod without secret, continue with available candidates
  }

  // Also include legacy derivation from primary secret for seamless backward compatibility
  const primarySecret =
    process.env.CREDENTIAL_ENCRYPTION_KEY?.trim() ||
    process.env.TOKEN_PEPPER?.trim() ||
    process.env.SESSION_SECRET?.trim() ||
    (process.env.NODE_ENV !== 'production' ? 'dev-local-credential-pepper-key-only' : '')

  if (primarySecret) {
    const legacyKey = deriveLegacyKey(primarySecret)
    candidates.push({ id: getKeyId(legacyKey), key: legacyKey })
  }

  // Include rotated previous keys if provided in PREVIOUS_CREDENTIAL_ENCRYPTION_KEYS
  const previousSecrets = (process.env.PREVIOUS_CREDENTIAL_ENCRYPTION_KEYS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const prev of previousSecrets) {
    const separatedKey = deriveKeyFromSecret(prev)
    candidates.push({ id: getKeyId(separatedKey), key: separatedKey })
    const legacyKey = deriveLegacyKey(prev)
    candidates.push({ id: getKeyId(legacyKey), key: legacyKey })
  }

  return candidates
}

/**
 * Encrypts a sensitive credential at rest using AES-256-GCM authenticated encryption.
 * Output format: enc:v1:<keyId>:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptCredential(plaintext: string | null | undefined): string | null {
  if (!plaintext || typeof plaintext !== 'string') return null
  if (plaintext.startsWith(PREFIX)) return plaintext // Already encrypted

  const iv = crypto.randomBytes(12)
  const { id: keyId, key } = getActiveKeyDescriptor()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  return `${PREFIX}${keyId}:${iv.toString('hex')}:${authTag}:${encrypted}`
}

/**
 * Decrypts an AES-256-GCM encrypted credential.
 * Supports versioned key IDs, rotation fallback, and legacy 3-part envelopes.
 * Falls back to returning the raw string if not encrypted (unencrypted migration path).
 */
export function decryptCredential(ciphertext: string | null | undefined): string | null {
  if (!ciphertext || typeof ciphertext !== 'string') return null
  if (!ciphertext.startsWith(PREFIX)) return ciphertext // Unencrypted fallback

  const raw = ciphertext.slice(PREFIX.length)
  const parts = raw.split(':')

  let keyId: string | undefined
  let ivHex: string
  let tagHex: string
  let dataHex: string

  if (parts.length === 4) {
    // Versioned format: enc:v1:<keyId>:<iv>:<tag>:<data>
    ;[keyId, ivHex, tagHex, dataHex] = parts
  } else if (parts.length === 3) {
    // Legacy format from commit 347ebf0: enc:v1:<iv>:<tag>:<data>
    ;[ivHex, tagHex, dataHex] = parts
  } else {
    return ciphertext
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(tagHex, 'hex')
  const candidates = getAllCandidateKeys()

  // Prioritize matching keyId if present
  if (keyId) {
    candidates.sort((a, b) => (a.id === keyId ? -1 : b.id === keyId ? 1 : 0))
  }

  for (const descriptor of candidates) {
    try {
      const decipher = crypto.createDecipheriv(ALGORITHM, descriptor.key, iv)
      decipher.setAuthTag(authTag)

      let decrypted = decipher.update(dataHex, 'hex', 'utf8')
      decrypted += decipher.final('utf8')
      return decrypted
    } catch {
      // Try next candidate key
      continue
    }
  }

  console.error(
    `[credentialCrypto] Decryption failed: MAC verification failed${
      keyId ? ` for keyId ${keyId}` : ''
    }. Check CREDENTIAL_ENCRYPTION_KEY or PREVIOUS_CREDENTIAL_ENCRYPTION_KEYS.`
  )
  return null
}

/**
 * Checks whether a given string is encrypted at rest with the active envelope.
 */
export function isCredentialEncrypted(val: string | null | undefined): boolean {
  return typeof val === 'string' && val.startsWith(PREFIX)
}
