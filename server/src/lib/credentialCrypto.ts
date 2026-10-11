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

let ephemeralDevSecret: string | null = null

function getEphemeralDevSecret(): string {
  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomBytes(32).toString('hex')
  }
  return ephemeralDevSecret
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
    const devKey = deriveKeyFromSecret(getEphemeralDevSecret())
    return { id: getKeyId(devKey), key: devKey }
  }

  const key = deriveKeyFromSecret(primarySecret)
  return { id: getKeyId(key), key }
}

/**
 * Returns all candidate decryption keys (active key, legacy keys, TOKEN_PEPPER keys, and rotated keys).
 */
function getAllCandidateKeys(): KeyDescriptor[] {
  const candidates: KeyDescriptor[] = []
  const seenIds = new Set<string>()

  function addKey(key: Buffer) {
    const id = getKeyId(key)
    if (!seenIds.has(id)) {
      seenIds.add(id)
      candidates.push({ id, key })
    }
  }

  // 1. Always prioritize the active key
  try {
    const active = getActiveKeyDescriptor()
    seenIds.add(active.id)
    candidates.push(active)
  } catch {
    // If active resolution fails in prod, continue with candidates
  }

  // 2. If CREDENTIAL_ENCRYPTION_KEY is configured, include its derived forms
  const explicitKey = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim()
  if (explicitKey) {
    addKey(crypto.createHash('sha256').update(explicitKey).digest())
    addKey(deriveKeyFromSecret(explicitKey))
    addKey(deriveLegacyKey(explicitKey))
  }

  // 3. ALWAYS include TOKEN_PEPPER-derived keys if TOKEN_PEPPER is set.
  // This ensures that existing credentials encrypted prior to CREDENTIAL_ENCRYPTION_KEY
  // rotation (both HMAC v1 and legacy SHA-256) decrypt seamlessly without data loss.
  const tokenPepper = process.env.TOKEN_PEPPER?.trim()
  if (tokenPepper) {
    addKey(deriveKeyFromSecret(tokenPepper))
    addKey(deriveLegacyKey(tokenPepper))
  }

  // 4. Also check SESSION_SECRET if present
  const sessionSecret = process.env.SESSION_SECRET?.trim()
  if (sessionSecret) {
    addKey(deriveKeyFromSecret(sessionSecret))
    addKey(deriveLegacyKey(sessionSecret))
  }

  // 5. In non-production, include ephemeral dev key if created
  if (ephemeralDevSecret) {
    addKey(deriveKeyFromSecret(ephemeralDevSecret))
    addKey(deriveLegacyKey(ephemeralDevSecret))
  }

  // 6. Include rotated previous keys if provided in PREVIOUS_CREDENTIAL_ENCRYPTION_KEYS
  const previousSecrets = (process.env.PREVIOUS_CREDENTIAL_ENCRYPTION_KEYS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  for (const prev of previousSecrets) {
    addKey(crypto.createHash('sha256').update(prev).digest())
    addKey(deriveKeyFromSecret(prev))
    addKey(deriveLegacyKey(prev))
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
    console.error(
      `[SECURITY ALERT] [credentialCrypto] Malformed encrypted envelope: expected 3 or 4 colon-separated parts, got ${parts.length}`
    )
    return null
  }

  // Validate hex encoding
  const isHex = (str: string) => /^[0-9a-fA-F]+$/.test(str)
  if (!ivHex || !tagHex || !dataHex || !isHex(ivHex) || !isHex(tagHex) || !isHex(dataHex)) {
    console.error('[SECURITY ALERT] [credentialCrypto] Malformed encrypted envelope: non-hex components in ciphertext')
    return null
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(tagHex, 'hex')
  if (iv.length !== 12 || authTag.length !== 16) {
    console.error(
      `[SECURITY ALERT] [credentialCrypto] Malformed encrypted envelope: invalid IV length (${iv.length}) or auth tag length (${authTag.length})`
    )
    return null
  }

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
    `[SECURITY ALERT] [credentialCrypto] Decryption failed: MAC verification failed${
      keyId ? ` for keyId ${keyId}` : ''
    }. Ciphertext may be corrupted, tampered, or encrypted under an unlisted key.`
  )
  return null
}

/**
 * Checks whether a given string is encrypted at rest with the AES-256-GCM envelope.
 */
export function isCredentialEncrypted(val: string | null | undefined): boolean {
  return typeof val === 'string' && val.startsWith(PREFIX)
}

/**
 * Checks whether an encrypted credential was created with a legacy envelope or older key ID,
 * indicating it should be re-encrypted under the active key.
 */
export function needsReencryption(ciphertext: string | null | undefined): boolean {
  if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.startsWith(PREFIX)) {
    return false
  }
  try {
    const { id: activeKeyId } = getActiveKeyDescriptor()
    const parts = ciphertext.slice(PREFIX.length).split(':')
    // Legacy 3-part format or versioned 4-part with non-matching key ID
    return parts.length !== 4 || parts[0] !== activeKeyId
  } catch {
    return false
  }
}

/**
 * Re-encrypts an existing encrypted credential under the current active key.
 * Returns the re-encrypted ciphertext, or unchanged if already active, or null if decryption failed.
 */
export function reencryptCredential(ciphertext: string | null | undefined): string | null {
  if (!ciphertext || !needsReencryption(ciphertext)) return ciphertext
  const decrypted = decryptCredential(ciphertext)
  if (decrypted === null) {
    console.error('[SECURITY ALERT] [credentialCrypto] Re-encryption skipped: cannot decrypt credential.')
    return null
  }
  return encryptCredential(decrypted)
}

