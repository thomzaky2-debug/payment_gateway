import assert from 'node:assert/strict'
import test from 'node:test'
import { otpEmailSubject, renderOtpHtml, renderOtpText } from './otpEmail.js'

test('OTP HTML and plain text identify each flow and retain the correct validity period', () => {
  const cases = [
    ['MERCHANT_LOGIN', 'Sign in to NilePay', 10],
    ['MERCHANT_SIGNUP', 'Verify your email', 10],
    ['PASSWORD_RESET', 'Reset your password', 10],
    ['ACCOUNT_DELETION', 'Confirm account deletion', 10],
    ['ACCOUNT_DELETION_PUBLIC', 'Confirm account deletion', 30],
  ] as const
  for (const [purpose, title, minutes] of cases) {
    const html = renderOtpHtml('012345', purpose)
    const text = renderOtpText('012345', purpose)
    assert.ok(html.includes(title))
    assert.ok(text.includes(title))
    assert.match(html, new RegExp(`${minutes} minutes`))
    assert.match(text, new RegExp(`${minutes} minutes`))
    assert.equal(html.split('012345').length, 2, 'one continuous, copyable code in HTML')
    assert.ok(text.includes('012345'))
    assert.ok(!otpEmailSubject(purpose).includes('012345'))
    assert.ok(!html.includes('no-reply@instapay'))
    assert.ok(html.includes('role="presentation"'))
    assert.ok(html.includes('font-size:16px;line-height:26px'))
    assert.ok(html.includes('mailto:nilepay.customers@gmail.com'))
    assert.ok(!html.includes('<img'), 'avoids external image tags that trigger spam filters')
    assert.ok(!html.includes('runasp.net'), 'avoids shared-hosting links that trigger anti-phishing filters')
    assert.ok(!text.includes('runasp.net'), 'avoids shared-hosting links in plain text')
    assert.ok(!html.includes('font-size:1px'), 'avoids hidden tiny text obfuscation flags')
    if (purpose.startsWith('ACCOUNT_DELETION')) assert.ok(text.includes('This email alone does not confirm deletion'))
  }
})

test('OTP rendering rejects markup, malformed codes and injection; unknown purposes get generic copy', () => {
  for (const otp of ['<script>alert(1)</script>', '12345', '1234567', '123456\n', '12 345', 'abcdef']) {
    assert.throws(() => renderOtpHtml(otp, 'MERCHANT_LOGIN'))
    assert.throws(() => renderOtpText(otp, 'MERCHANT_LOGIN'))
  }
  const html = renderOtpHtml('123456', '<script>alert(1)</script>')
  assert.ok(!html.includes('<script>'))
  assert.ok(html.includes('Verify your request'))
})
