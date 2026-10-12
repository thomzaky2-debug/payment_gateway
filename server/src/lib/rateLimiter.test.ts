import assert from 'node:assert/strict'
import test from 'node:test'
import { createRateLimiter } from './rateLimiter.js'

test('local test rate limiter rejects requests above the configured limit', async () => {
  const limiter = createRateLimiter(60_000, 2, 'Rate limited for test')
  const ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`

  const invoke = () => new Promise<{ statusCode?: number; body?: unknown; passed: boolean }>((resolve) => {
    const response: any = {
      setHeader: () => undefined,
      status(statusCode: number) {
        response.statusCode = statusCode
        return response
      },
      json(body: unknown) {
        resolve({ statusCode: response.statusCode, body, passed: false })
      },
    }
    limiter(
      { ip, socket: { remoteAddress: ip } } as any,
      response,
      () => resolve({ passed: true })
    )
  })

  assert.equal((await invoke()).passed, true)
  assert.equal((await invoke()).passed, true)
  const blocked = await invoke()
  assert.equal(blocked.passed, false)
  assert.equal(blocked.statusCode, 429)
  assert.equal((blocked.body as any).ok, false)
  assert.equal((blocked.body as any).error, 'Rate limited for test')
  assert.equal(typeof (blocked.body as any).retryAfterSeconds, 'number')
})
