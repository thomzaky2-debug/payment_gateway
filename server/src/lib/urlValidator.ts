import { URL } from 'url'
import net from 'net'
import dns from 'dns'

/**
 * Strips enclosing brackets from bracketed IPv6 hostnames (e.g. "[::1]" -> "::1")
 */
function cleanIpString(rawIp: string): string {
  return rawIp.trim().replace(/^\[|\]$/g, '')
}

/**
 * Checks if an IP address is a private/internal, loopback, link-local, or reserved address.
 * Covers both IPv4 and IPv6 (including IPv4-mapped IPv6).
 */
export function isPrivateIp(rawIp: string): boolean {
  const ip = cleanIpString(rawIp)
  if (!net.isIP(ip)) return false

  // ─── IPv4-Mapped IPv6 (e.g. ::ffff:127.0.0.1, ::ffff:7f00:1, ::ffff:10.0.0.1) ────
  if (ip.toLowerCase().startsWith('::ffff:')) {
    const embedded = ip.slice(7)
    if (net.isIPv4(embedded)) {
      return isPrivateIp(embedded)
    }
    // Handle hex-encoded format produced by WHATWG URL parser (e.g. 7f00:1)
    if (embedded.includes(':')) {
      const parts = embedded.split(':')
      if (parts.length === 2) {
        const v1 = parseInt(parts[0], 16)
        const v2 = parseInt(parts[1], 16)
        if (!isNaN(v1) && !isNaN(v2)) {
          const b0 = (v1 >> 8) & 0xff
          const b1 = v1 & 0xff
          const b2 = (v2 >> 8) & 0xff
          const b3 = v2 & 0xff
          return isPrivateIp(`${b0}.${b1}.${b2}.${b3}`)
        }
      }
    }
  }

  // ─── IPv4 private/internal/reserved ranges ─────────────────────────
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number)
    const [b0, b1] = parts

    // Loopback: 127.0.0.0/8
    if (b0 === 127) return true
    // Link-local / Cloud Metadata: 169.254.0.0/16
    if (b0 === 169 && b1 === 254) return true
    // Class A private: 10.0.0.0/8
    if (b0 === 10) return true
    // Class B private: 172.16.0.0/12
    if (b0 === 172 && b1 >= 16 && b1 <= 31) return true
    // Class C private: 192.168.0.0/16
    if (b0 === 192 && b1 === 168) return true
    // Current network: 0.0.0.0/8
    if (b0 === 0) return true
    // Carrier-Grade NAT (RFC 6598): 100.64.0.0/10
    if (b0 === 100 && b1 >= 64 && b1 <= 127) return true
    // Test networks (RFC 5737): 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
    if (b0 === 192 && b1 === 0 && parts[2] === 2) return true
    if (b0 === 198 && b1 === 51 && parts[2] === 100) return true
    if (b0 === 203 && b1 === 0 && parts[2] === 113) return true
    // Benchmark testing (RFC 2544): 198.18.0.0/15
    if (b0 === 198 && (b1 === 18 || b1 === 19)) return true
    // Broadcast & Multicast: 224.0.0.0/4 and 255.255.255.255
    if (b0 >= 224) return true

    return false
  }

  // ─── IPv6 private/internal/reserved ranges ─────────────────────────
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase()

    // Unspecified / Loopback: :: or ::1
    if (normalized === '::' || normalized === '::1' || normalized === '0:0:0:0:0:0:0:1' || normalized === '0:0:0:0:0:0:0:0') {
      return true
    }

    // Unique Local Addresses (ULA): fc00::/7 (starts with fc or fd)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) {
      return true
    }

    // Link-Local Unicast: fe80::/10 (starts with fe8, fe9, fea, feb)
    if (/^fe[89ab]/i.test(normalized)) {
      return true
    }

    // Discard prefix / Documentation (RFC 3849): 2001:db8::/32
    if (normalized.startsWith('2001:db8') || normalized.startsWith('2001:0db8')) {
      return true
    }

    // Multicast: ff00::/8
    if (normalized.startsWith('ff')) {
      return true
    }

    return false
  }

  return false
}

/**
 * Validates a webhook URL statically against SSRF attacks and protocol restrictions.
 */
export function validateWebhookUrl(rawUrl: string): { valid: boolean; error?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Webhook URL cannot be empty' }
  }

  const trimmed = rawUrl.trim()

  try {
    const parsed = new URL(trimmed)

    const allowHttp = process.env.ALLOW_HTTP_WEBHOOKS === 'true'
    if (parsed.protocol !== 'https:' && (!allowHttp || parsed.protocol !== 'http:')) {
      return { valid: false, error: 'Webhook URL must use HTTPS protocol' }
    }

    const rawHostname = parsed.hostname.toLowerCase()
    const cleanHost = cleanIpString(rawHostname)

    const allowPrivate = process.env.ALLOW_PRIVATE_WEBHOOKS === 'true'
    if (!allowPrivate) {
      // Disallow localhost or internal domains
      if (
        cleanHost === 'localhost' ||
        cleanHost.endsWith('.localhost') ||
        cleanHost.endsWith('.local') ||
        cleanHost.endsWith('.internal') ||
        cleanHost.endsWith('.intranet') ||
        cleanHost.endsWith('.lan') ||
        cleanHost === '169.254.169.254' ||
        cleanHost === 'metadata.google.internal'
      ) {
        return { valid: false, error: 'Internal/loopback webhook URLs are not allowed' }
      }

      if (isPrivateIp(cleanHost)) {
        return { valid: false, error: 'Private IP webhook destinations are not allowed' }
      }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}

/**
 * Resolves the URL hostname via DNS and validates all resolved IP addresses
 * against private/reserved ranges to prevent DNS rebinding SSRF attacks.
 */
export async function validateWebhookUrlDns(rawUrl: string): Promise<{ valid: boolean; error?: string }> {
  const staticCheck = validateWebhookUrl(rawUrl)
  if (!staticCheck.valid) {
    return staticCheck
  }

  const allowPrivate = process.env.ALLOW_PRIVATE_WEBHOOKS === 'true'
  if (allowPrivate) {
    return { valid: true }
  }

  try {
    const parsed = new URL(rawUrl.trim())
    const hostname = cleanIpString(parsed.hostname.toLowerCase())

    // If hostname is already an IP address, staticCheck already checked it
    if (net.isIP(hostname)) {
      if (isPrivateIp(hostname)) {
        return { valid: false, error: 'Private IP addresses are not permitted' }
      }
      return { valid: true }
    }

    // Resolve all IPv4 and IPv6 addresses for the hostname
    const records = await dns.promises.lookup(hostname, { all: true })
    if (!records || records.length === 0) {
      return { valid: false, error: 'Failed to resolve webhook domain DNS' }
    }

    for (const record of records) {
      if (isPrivateIp(record.address)) {
        return {
          valid: false,
          error: `Webhook hostname resolves to forbidden private IP: ${record.address}`,
        }
      }
    }

    return { valid: true }
  } catch (err: unknown) {
    const error = err as Error
    return { valid: false, error: `DNS resolution failed: ${error.message}` }
  }
}
