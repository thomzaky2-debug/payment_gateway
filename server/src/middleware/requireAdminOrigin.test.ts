import assert from 'node:assert/strict'
import test from 'node:test'
import type { Request, Response } from 'express'
import { requireAdminOrigin } from './requireAdminOrigin.js'

function invoke(options: {
  path?: string
  origin?: string
  referer?: string
  authorization?: string
}): Promise<{ statusCode: number; body: unknown; nextCalled: boolean }> {
  return new Promise((resolve) => {
    let nextCalled = false
    const headers: Record<string, string | undefined> = {
      origin: options.origin,
      referer: options.referer,
      authorization: options.authorization,
    }
    const req = {
      path: options.path || '/stats',
      headers,
      get: (name: string) => headers[name.toLowerCase()],
    } as unknown as Request
    const result = { statusCode: 200, body: undefined as unknown, nextCalled }
    const res = {
      status: (statusCode: number) => {
        result.statusCode = statusCode
        return res
      },
      json: (body: unknown) => {
        result.body = body
        resolve(result)
        return res
      },
    } as unknown as Response
    const next = () => {
      result.nextCalled = true
      resolve(result)
    }
    requireAdminOrigin('https://admin.example.test')(req, res, next)
  })
}

test('admin browser API requests must come from the dedicated admin origin', async () => {
  assert.equal((await invoke({ origin: 'https://admin.example.test' })).nextCalled, true)
  assert.equal((await invoke({ referer: 'https://admin.example.test/overview' })).nextCalled, true)

  const merchantSite = await invoke({ origin: 'https://app.example.test' })
  assert.equal(merchantSite.statusCode, 403)
  assert.deepEqual(merchantSite.body, {
    ok: false,
    error: 'Admin requests must originate from the configured admin portal.',
  })
})

test('native bearer clients and originless first login remain supported', async () => {
  assert.equal((await invoke({ authorization: 'Bearer native-session-token' })).nextCalled, true)
  assert.equal((await invoke({ path: '/auth' })).nextCalled, true)
  assert.equal((await invoke({ path: '/stats' })).statusCode, 403)
})
