import { URL } from 'url'
import net from 'net'

/**
 * Checks if an IP address is a private/internal or loopback address.
 */
export function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) return false

  // IPv4 private/internal/reserved ranges
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
    // Current network (0.0.0.0/8)
    if (b0 === 0) return true
    // Broadcast
    if (ip === '255.255.255.255') return true

    return false
  }

  // IPv6
  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase()
    // Loopback ::1
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true
    // Unique local addresses (fc00::/7)
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
    // Link-local (fe80::/10)
    if (normalized.startsWith('fe80')) return true
  }

  return false
}

/**
 * Validates a webhook URL against SSRF attacks and protocol restrictions.
 */
export function validateWebhookUrl(rawUrl: string): { valid: boolean; error?: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'Webhook URL cannot be empty' }
  }

  const trimmed = rawUrl.trim()

  try {
    const parsed = new URL(trimmed)

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Webhook URL must use http or https protocol' }
    }

    const hostname = parsed.hostname.toLowerCase()

    // Disallow localhost or internal domains in production
    if (process.env.NODE_ENV === 'production') {
      if (
        hostname === 'localhost' ||
        hostname.endsWith('.localhost') ||
        hostname.endsWith('.local') ||
        hostname.endsWith('.internal') ||
        hostname === '169.254.169.254' ||
        hostname === 'metadata.google.internal'
      ) {
        return { valid: false, error: 'Internal/loopback webhook URLs are not allowed in production' }
      }

      if (isPrivateIp(hostname)) {
        return { valid: false, error: 'Private IP webhook destinations are not allowed in production' }
      }
    }

    return { valid: true }
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }
}
