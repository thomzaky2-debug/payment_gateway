import crypto from 'crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function decodeBase32(value: string): Buffer | null {
  const clean = value.toUpperCase().replace(/[\s=]/g, '')
  if (!clean) return null
  let bits = ''
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char)
    if (index < 0) return null
    bits += index.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2))
  }
  return Buffer.from(bytes)
}

export function isValidTotpSecret(base32Secret: unknown, minBytes = 10): boolean {
  if (typeof base32Secret !== 'string' || !/^[A-Z2-7\s=]+$/i.test(base32Secret)) return false
  const decoded = decodeBase32(base32Secret)
  return Boolean(decoded && decoded.length >= minBytes)
}

function totpAt(secret: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigUInt64BE(BigInt(counter))
  const digest = crypto.createHmac('sha1', secret).update(counterBuffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)
  return String(binary % 1_000_000).padStart(6, '0')
}

export function verifyTotp(code: unknown, base32Secret: string, nowMs = Date.now()): boolean {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return false
  const secret = decodeBase32(base32Secret)
  if (!secret || secret.length < 10) return false

  const counter = Math.floor(nowMs / 30_000)
  for (let drift = -1; drift <= 1; drift += 1) {
    const expected = totpAt(secret, counter + drift)
    if (crypto.timingSafeEqual(Buffer.from(code), Buffer.from(expected))) return true
  }
  return false
}
