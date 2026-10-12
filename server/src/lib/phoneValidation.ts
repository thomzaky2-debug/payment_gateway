/**
 * Accepts an Egyptian mobile number entered in local form (01 followed by nine
 * digits) and returns the canonical E.164-style value used by the platform.
 */
export function normalizeEgyptianMobileNumber(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const localNumber = value.trim()
  if (!/^01\d{9}$/.test(localNumber)) return null
  return `+2${localNumber}`
}
