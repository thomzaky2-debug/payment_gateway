const PAYMENT_LINK_PATTERN = /^\/S\/([^/?#\s]+)\/instapay\/([^/?#\s]+)\/?$/i

export interface InstaPayPaymentLink {
  paymentUrl: string
  handle: string
}

/**
 * Validates the direct merchant share link issued by InstaPay and derives the
 * receiving IPA from it. Keeping this strict avoids storing an arbitrary URL
 * as a payment destination.
 */
export function parseInstaPayPaymentLink(value: unknown): InstaPayPaymentLink | null {
  if (typeof value !== 'string' || !value.trim()) return null

  try {
    const url = new URL(value.trim())
    if (
      url.protocol !== 'https:' ||
      url.hostname.toLowerCase() !== 'ipn.eg' ||
      url.port ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      return null
    }

    const match = url.pathname.match(PAYMENT_LINK_PATTERN)
    if (!match) return null

    const merchantId = match[1].toLowerCase().replace(/^@/, '')
    if (!merchantId) return null

    return {
      paymentUrl: `https://ipn.eg/S/${match[1]}/instapay/${match[2]}`,
      handle: `${merchantId}@instapay`,
    }
  } catch {
    return null
  }
}
