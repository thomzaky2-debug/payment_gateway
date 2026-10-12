import assert from 'node:assert/strict'
import test from 'node:test'
import { validateRuntimeConfig } from './config.js'

const SECURITY_ENV_KEYS = [
  'NODE_ENV',
  'OWNER_SECRET',
  'TOKEN_PEPPER',
  'ADMIN_PASSWORD',
  'ADMIN_EMAIL',
  'ADMIN_TOTP_SECRET',
  'CLIENT_URL',
  'TRUST_PROXY',
  'AUTH_ALLOW_DEV_BYPASS',
  'AUTH_EXPOSE_DEV_OTP',
  'RESEND_API_KEY',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const

test('production configuration rejects shipped placeholders and malformed TOTP secrets', () => {
  const original = Object.fromEntries(SECURITY_ENV_KEYS.map((key) => [key, process.env[key]]))

  try {
    Object.assign(process.env, {
      NODE_ENV: 'production',
      OWNER_SECRET: 'replace-with-a-very-long-random-secret-for-owner-sessions',
      TOKEN_PEPPER: '724ea276087d6891c719ba521e03502973956d5b7e42f6129b9d764c54992aa1',
      ADMIN_PASSWORD: 'Strong admin passphrase 2026!',
      ADMIN_EMAIL: 'owner@example.test',
      ADMIN_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      CLIENT_URL: 'https://gateway.example.test',
      TRUST_PROXY: '0',
      AUTH_ALLOW_DEV_BYPASS: 'false',
      AUTH_EXPOSE_DEV_OTP: 'false',
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_USER: 'instapay.payment.gateway@gmail.com',
      SMTP_PASS: 'test-only-app-password',
      UPSTASH_REDIS_REST_URL: 'https://test-rate-limit.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-only-upstash-token',
    })

    assert.throws(validateRuntimeConfig, /known placeholder/)

    process.env.OWNER_SECRET = '9936112cc5d10c7d8b6adf36a092b0a3a26d51092801154b9cd8e27c048dcc18'
    process.env.ADMIN_TOTP_SECRET = 'not-a-base32-secret-that-is-long'
    assert.throws(validateRuntimeConfig, /valid Base32/)

    process.env.ADMIN_TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    assert.throws(validateRuntimeConfig, /UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN/)

    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-only-upstash-token'
    assert.doesNotThrow(validateRuntimeConfig)
  } finally {
    for (const key of SECURITY_ENV_KEYS) {
      const value = original[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
