import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultSiteSettings, validateSiteSettings } from './publicSiteSettings.js'
import { renderPrivacyHtml } from '../views/privacyHtml.js'

test('default contacts use international WhatsApp format and the provided Facebook URL', () => {
  const settings = validateSiteSettings(defaultSiteSettings)
  assert.equal(settings.whatsappNumber, '+201114671033')
  assert.equal(settings.facebookUrl, 'https://www.facebook.com/share/19n4Woi3U9')
})

test('rejects unsafe contact links, invalid numbers and missing fields', () => {
  for (const facebookUrl of ['javascript:alert(1)', 'https://facebook.com.evil.test/x', 'http://facebook.com/x', 'https://user:pass@facebook.com/x']) {
    assert.throws(() => validateSiteSettings({ ...defaultSiteSettings, facebookUrl }))
  }
  assert.throws(() => validateSiteSettings({ ...defaultSiteSettings, supportEmail: 'test@example.com\r\nBcc:other@example.com' }))
  assert.throws(() => validateSiteSettings({ ...defaultSiteSettings, whatsappNumber: '01114671033' }))
  assert.throws(() => validateSiteSettings({}))
  assert.throws(() => validateSiteSettings({ ...defaultSiteSettings, privacyText: 'x'.repeat(40001) }))
})

test('custom policy and operator are escaped and cannot inject scripts', () => {
  const html = renderPrivacyHtml({ ...defaultSiteSettings, operatorName: '<img src=x onerror=alert(1)>', privacyText: '<script>alert(1)</script>\nTerms' })
  assert.doesNotMatch(html, /<script>|<img/)
  assert.match(html, /&lt;script&gt;/)
  assert.match(html, /href="\/account-deletion"/)
  assert.match(html, /nilepay.customers@gmail.com/)
})

test('default policy uses changed operator and email, including literal replacement symbols', () => {
  const html = renderPrivacyHtml({ ...defaultSiteSettings, operatorName: 'Company $&', supportEmail: 'help@example.com' })
  assert.match(html, /Company \$&amp;/)
  assert.match(html, /mailto:help@example.com/)
  assert.doesNotMatch(html, /nilepay.customers@gmail.com/)
})
