import { URL } from 'url'
import net from 'net'
import dns from 'dns'

/**
 * Strips enclosing brackets from bracketed IPv6 hostnames (e.g. "[::1]" -> "::1")
 */
export function cleanIpString(rawIp: string): string {
  return rawIp.trim().replace(/^\[|\]$/g, '')
}

/**
 * Unconditionally checks if a host is cloud metadata (AWS, GCP, Azure, DigitalOcean).
 * Link-local metadata (169.254.0.0/16, fe80::/10, metadata.google.internal) must NEVER be reached.
 */
export function isCloudMetadata(rawHost: string): boolean {
  const host = cleanIpString(rawHost.toLowerCase())
  if (
    host === '169.254.169.254' ||
    host === 'metadata.google.internal' ||
    host === 'instance-data' ||
    host.endsWith('.metadata.google.internal')
  ) {
    return true
  }

  // Handle IPv4-mapped IPv6 syntax
  if (host.startsWith('::ffff:')) {
    const embedded = host.slice(7)
    if (net.isIPv4(embedded)) return isCloudMetadata(embedded)
    if (embedded.includes(':')) {
      const parts = embedded.split(':')
      if (parts.length === 2) {
        const v1 = parseInt(parts[0], 16)
        const b0 = (v1 >> 8) & 0xff
        const b1 = v1 & 0xff
        if (b0 === 169 && b1 === 254) return true
      }
    }
  }

  if (net.isIPv4(host)) {
    const parts = host.split('.').map(Number)
    if (parts[0] === 169 && parts[1] === 254) return true
  }

  if (net.isIPv6(host)) {
    if (/^fe[89ab]/i.test(host)) return true
  }

  return false
}

/**
 * Checks if an IP address is a private/internal, loopback, link-local, or reserved address.
 * Covers both IPv4 and IPv6 (including IPv4-mapped IPv6).
 */
export function isPrivateIp(rawIp: string): boolean {
  const ip = cleanIpString(rawIp)
  if (!net.isIP(ip)) return false

  // Cloud metadata is unconditionally private and blocked
  if (isCloudMetadata(ip)) return true

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
    // IETF protocol assignments (RFC 6890): 192.0.0.0/24
    if (b0 === 192 && b1 === 0 && parts[2] === 0) return true
    // Azure wire server / instance metadata
    if (ip === '168.63.129.16') return true
    // Broadcast & Multicast: 224.0.0.0/4 and 255.255.255.255
    if (b0 >= 224) return true

    return false
  }

  // ─── IPv6 private/internal/reserved ranges ─────────────────────────
  if (net.isIPv6(ip)) {
    const words = expandIpv6(ip)
    if (!words) return true // unparseable → fail closed

    const [w0, w1, w2, w3, w4, w5, w6, w7] = words
    const embeddedIpv4 = `${w6 >> 8}.${w6 & 0xff}.${w7 >> 8}.${w7 & 0xff}`

    // Unspecified (::) and loopback (::1)
    if (words.slice(0, 7).every((w) => w === 0) && (w7 === 0 || w7 === 1)) return true
    // IPv4-mapped ::ffff:a.b.c.d and the deprecated IPv4-compatible ::a.b.c.d
    if (w0 === 0 && w1 === 0 && w2 === 0 && w3 === 0 && w4 === 0 && (w5 === 0xffff || w5 === 0)) {
      return isPrivateIp(embeddedIpv4)
    }
    // NAT64 well-known prefix 64:ff9b::/96 and local-use 64:ff9b:1::/48 (RFC 6052 / 8215)
    if (w0 === 0x64 && w1 === 0xff9b) {
      if (w2 === 1) return true
      if (w2 === 0 && w3 === 0 && w4 === 0 && w5 === 0) return isPrivateIp(embeddedIpv4)
    }
    // 6to4 2002:a.b.c.d::/48 embeds the IPv4 in the second and third words
    if (w0 === 0x2002) return isPrivateIp(`${w1 >> 8}.${w1 & 0xff}.${w2 >> 8}.${w2 & 0xff}`)
    // Teredo 2001::/32 carries an obfuscated IPv4; never a legitimate webhook host
    if (w0 === 0x2001 && w1 === 0) return true
    // Discard-only 100::/64
    if (w0 === 0x100 && w1 === 0 && w2 === 0 && w3 === 0) return true
    // Unique local fc00::/7
    if ((w0 & 0xfe00) === 0xfc00) return true
    // Link-local fe80::/10 and deprecated site-local fec0::/10
    if ((w0 & 0xffc0) === 0xfe80 || (w0 & 0xffc0) === 0xfec0) return true
    // Documentation 2001:db8::/32
    if (w0 === 0x2001 && w1 === 0xdb8) return true
    // Multicast ff00::/8
    if ((w0 & 0xff00) === 0xff00) return true

    return false
  }

  return false
}

/** Expands any textual IPv6 form (::, zone ids, embedded IPv4) into eight 16-bit words. */
export function expandIpv6(rawIp: string): number[] | null {
  let ip = cleanIpString(rawIp).toLowerCase().split('%')[0]
  // Rewrite a trailing dotted IPv4 (::ffff:1.2.3.4) as two hex words
  const dotted = ip.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (dotted) {
    const octets = dotted.slice(2, 6).map(Number)
    if (octets.some((o) => o > 255)) return null
    ip = `${dotted[1]}${((octets[0] << 8) | octets[1]).toString(16)}:${((octets[2] << 8) | octets[3]).toString(16)}`
  }
  const halves = ip.split('::')
  if (halves.length > 2) return null
  const head = halves[0] ? halves[0].split(':') : []
  const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : []
  const missing = 8 - head.length - tail.length
  if (missing < 0 || (halves.length === 1 && missing !== 0)) return null
  const parts = [...head, ...Array(halves.length === 2 ? missing : 0).fill('0'), ...tail]
  if (parts.length !== 8) return null
  const words = parts.map((p) => (/^[0-9a-f]{1,4}$/.test(p) ? parseInt(p, 16) : NaN))
  return words.some(Number.isNaN) ? null : words
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
    const isProduction = process.env.NODE_ENV === 'production'

    // In production, HTTP is strictly forbidden regardless of any env flag
    const allowHttp = !isProduction && process.env.ALLOW_HTTP_WEBHOOKS === 'true'
    if (parsed.protocol !== 'https:' && (!allowHttp || parsed.protocol !== 'http:')) {
      return { valid: false, error: 'Webhook URL must use HTTPS protocol' }
    }

    const rawHostname = parsed.hostname.toLowerCase()
    const cleanHost = cleanIpString(rawHostname)

    // Unconditional cloud metadata rejection in ALL environments
    if (isCloudMetadata(cleanHost)) {
      return { valid: false, error: 'Cloud metadata webhook destinations are forbidden' }
    }

    // In production, private IP / internal destinations are strictly forbidden
    const allowPrivate = !isProduction && process.env.ALLOW_PRIVATE_WEBHOOKS === 'true'
    if (!allowPrivate) {
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

export interface DnsValidationResult {
  valid: boolean
  error?: string
  pinnedIp?: string
}

/**
 * Resolves the URL hostname via DNS, validates all resolved IP addresses,
 * and returns the validated IP to be pinned to prevent DNS rebinding.
 */
export async function validateWebhookUrlDns(rawUrl: string): Promise<DnsValidationResult> {
  const staticCheck = validateWebhookUrl(rawUrl)
  if (!staticCheck.valid) {
    return staticCheck
  }

  const isProduction = process.env.NODE_ENV === 'production'
  const allowPrivate = !isProduction && process.env.ALLOW_PRIVATE_WEBHOOKS === 'true'

  try {
    const parsed = new URL(rawUrl.trim())
    const hostname = cleanIpString(parsed.hostname.toLowerCase())

    // If hostname is already an IP address
    if (net.isIP(hostname)) {
      if (isCloudMetadata(hostname)) {
        return { valid: false, error: 'Cloud metadata destinations are forbidden' }
      }
      if (!allowPrivate && isPrivateIp(hostname)) {
        return { valid: false, error: 'Private IP addresses are not permitted' }
      }
      return { valid: true, pinnedIp: hostname }
    }

    // Resolve all IPv4 and IPv6 addresses for the hostname
    const records = await dns.promises.lookup(hostname, { all: true })
    if (!records || records.length === 0) {
      return { valid: false, error: 'Failed to resolve webhook domain DNS' }
    }

    for (const record of records) {
      if (isCloudMetadata(record.address)) {
        return { valid: false, error: 'Domain resolves to forbidden cloud metadata IP' }
      }
      if (!allowPrivate && isPrivateIp(record.address)) {
        return {
          valid: false,
          error: `Webhook hostname resolves to forbidden private IP: ${record.address}`,
        }
      }
    }

    // Return the first validated IP for socket pinning
    return { valid: true, pinnedIp: records[0].address }
  } catch (err: unknown) {
    const error = err as Error
    return { valid: false, error: `DNS resolution failed: ${error.message}` }
  }
}

/**
 * Creates a custom DNS lookup callback function for http(s).Agent that pins outbound connections
 * to the verified IP address, preventing DNS rebinding attacks while maintaining Node 22 compatibility.
 */
export function createPinnedDnsLookup(pinnedIp: string | null | undefined) {
  if (!pinnedIp) return undefined
  return (_hostname: string, opts: any, cb: (err: Error | null, addressOrAddresses: any, family?: number) => void) => {
    const family = net.isIPv6(pinnedIp) ? 6 : 4
    if (opts?.all) {
      cb(null, [{ address: pinnedIp, family }])
    } else {
      cb(null, pinnedIp, family)
    }
  }
}

