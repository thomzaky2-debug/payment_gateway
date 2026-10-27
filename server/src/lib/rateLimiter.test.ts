import assert from 'node:assert/strict'
import test from 'node:test'
import { createRateLimiter } from './rateLimiter.js'

test('changing a proxy source port does not reset the per-IP limit', async () => {
  const limiter = createRateLimiter(61_000, 1)
  const invoke = (port: number) => new Promise<number>((resolve) => {
    const response: any = {
      setHeader() {},
      status(code: number) { response.statusCode = code; return response },
      json() { resolve(response.statusCode) },
    }
    limiter({ ip: `203.0.113.44:${port}`, socket: { remoteAddress: '10.0.0.1' } } as any, response, () => resolve(200))
  })
  assert.equal(await invoke(15152), 200)
  assert.equal(await invoke(40039), 429)
})

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
