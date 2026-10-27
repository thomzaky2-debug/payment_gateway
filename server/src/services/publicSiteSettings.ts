import { db } from '../db.js'

export const defaultSiteSettings = {
  operatorName: 'Premium Service',
  supportEmail: 'nilepay.customers@gmail.com',
  whatsappNumber: '+201114671033',
  facebookName: 'NilePay',
  facebookUrl: 'https://www.facebook.com/share/19n4Woi3U9',
  privacyText: '',
}
export type PublicSiteSettings = typeof defaultSiteSettings

export function validateSiteSettings(input: unknown): PublicSiteSettings {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Settings must be an object.')
  const source = input as Record<string, unknown>
  const result = { ...defaultSiteSettings }
  for (const key of Object.keys(result) as (keyof PublicSiteSettings)[]) {
    if (typeof source[key] !== 'string') throw new Error(`Missing text field: ${key}`)
    result[key] = (source[key] as string).trim()
    if (result[key].length > (key === 'privacyText' ? 40000 : 320)) throw new Error(`${key} is too long.`)
  }
  if (!result.operatorName || !result.facebookName) throw new Error('Operator and Facebook page names are required.')
  if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(result.supportEmail) || /[\r\n]/.test(result.supportEmail)) throw new Error('Enter a valid support email.')
  if (!/^\+[1-9]\d{7,14}$/.test(result.whatsappNumber)) throw new Error('WhatsApp must use international format, for example +201114671033.')
  if (result.facebookUrl) {
    const url = new URL(result.facebookUrl)
    if (url.protocol !== 'https:' || !['facebook.com', 'www.facebook.com', 'm.facebook.com'].includes(url.hostname) || url.username || url.password || url.port) throw new Error('Use an HTTPS facebook.com page URL.')
    result.facebookUrl = url.href
  }
  return result
}

export async function getPublicSiteSettings(): Promise<PublicSiteSettings> {
  const row = await db.publicSiteSettings.findUnique({ where: { id: 'public' } })
  return row ? validateSiteSettings(row.content) : { ...defaultSiteSettings }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}
