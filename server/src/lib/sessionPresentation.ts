import { isIP } from 'node:net'

/** Normalize proxy IP:port values without trusting forwarded headers directly. */
export function normalizeIpAddress(value: string | null | undefined): string | null {
  if (!value) return null
  let ip = value.trim()
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d{1,5})?$/)
  if (bracketed) ip = bracketed[1]
  if (!isIP(ip)) {
    const withPort = ip.match(/^((?:::ffff:)?\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/i)
    if (!withPort) return null
    ip = withPort[1]
  }
  if (/^::ffff:/i.test(ip) && isIP(ip.slice(7)) === 4) ip = ip.slice(7)
  return isIP(ip) ? ip : null
}

export function describeSessionUserAgent(userAgent: string | null): { device: string; browser: string } {
  const ua = userAgent || ''
  const version = (name: string, expression: RegExp) => {
    const match = ua.match(expression)
    return match?.[1] ? `${name} ${match[1]}` : name
  }
  const browser = /edg(?:a|ios)?\//i.test(ua) ? version('Microsoft Edge', /edg(?:a|ios)?\/([\d.]+)/i)
    : /opr\//i.test(ua) ? version('Opera', /opr\/([\d.]+)/i)
      : /firefox\/|fxios\//i.test(ua) ? version('Firefox', /(?:firefox|fxios)\/([\d.]+)/i)
        : /chrome\/|crios\//i.test(ua) ? version('Chrome', /(?:chrome|crios)\/([\d.]+)/i)
          : /safari\//i.test(ua) ? version('Safari', /version\/([\d.]+)/i)
            : 'Unknown browser'
  const device = /iphone/i.test(ua) ? 'iPhone'
    : /ipad/i.test(ua) ? 'iPad'
      : /android/i.test(ua) ? 'Android device'
        : /windows/i.test(ua) ? 'Windows device'
          : /macintosh|mac os/i.test(ua) ? 'Mac'
            : /linux/i.test(ua) ? 'Linux device'
              : 'Unknown device'
  return { device, browser }
}

interface SessionRow {
  id: string
  tokenHash: string
  userAgent: string | null
  ipAddress: string | null
  deviceId: string | null
  refreshTokenHash: string | null
  createdAt: Date
  lastSeenAt: Date
}

export interface EnrolledSessionDevice {
  deviceId: string
  name: string | null
  appVersion: string | null
}

export function presentSession(session: SessionRow, currentTokenHash: string | null, device?: EnrolledSessionDevice) {
  const ua = describeSessionUserAgent(session.userAgent)
  const isMobile = Boolean(session.deviceId || session.refreshTokenHash)
  return {
    id: session.id,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    device: isMobile ? (device?.name?.trim().slice(0, 100) || 'Android device') : ua.device,
    browser: isMobile ? `NilePay Merchant${device?.appVersion ? ` ${device.appVersion}` : ''}` : ua.browser,
    isMobile,
    ipAddress: normalizeIpAddress(session.ipAddress),
    // No city is inferred without an actual geolocation source.
    location: null,
    current: Boolean(currentTokenHash && session.tokenHash === currentTokenHash),
  }
}
