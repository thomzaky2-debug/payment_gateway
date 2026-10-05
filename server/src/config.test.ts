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
  'AUTH_ALLOW_DEV_BYPASS',
  'AUTH_EXPOSE_DEV_OTP',
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
      AUTH_ALLOW_DEV_BYPASS: 'false',
      AUTH_EXPOSE_DEV_OTP: 'false',
    })

    assert.throws(validateRuntimeConfig, /known placeholder/)

    process.env.OWNER_SECRET = '9936112cc5d10c7d8b6adf36a092b0a3a26d51092801154b9cd8e27c048dcc18'
    process.env.ADMIN_TOTP_SECRET = 'not-a-base32-secret-that-is-long'
    assert.throws(validateRuntimeConfig, /valid Base32/)

    process.env.ADMIN_TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ'
    assert.doesNotThrow(validateRuntimeConfig)
  } finally {
    for (const key of SECURITY_ENV_KEYS) {
      const value = original[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
