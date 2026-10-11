/**
 * Parses the explicit reverse-proxy trust boundary used for client IPs,
 * rate limiting, and audit logs. `true` is one trusted proxy hop.
 */
export function parseTrustProxy(value: string | undefined, requireExplicit = false): false | number {
  const normalized = value?.trim().toLowerCase()
  if (!normalized) {
    if (requireExplicit) {
      throw new Error('TRUST_PROXY must be explicitly set to true, false, or a non-negative proxy hop count outside local development')
    }
    return false
  }

  if (normalized === 'true') return 1
  if (normalized === 'false') return false
  if (/^\d+$/.test(normalized)) {
    const hops = Number(normalized)
    if (Number.isSafeInteger(hops)) return hops
  }

  throw new Error('TRUST_PROXY must be true, false, or a non-negative proxy hop count')
}
