import { Router, Request, Response } from 'express'
import { authenticateByApiKey } from '../services/authService.js'
import { createCheckoutSession, getCheckoutSession } from '../services/checkoutService.js'

export const v1CheckoutRouter = Router()

// Middleware to authenticate merchant by API key
async function requireApiKey(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).json({ ok: false, error: 'Missing Authorization header with API key' })
  }

  const client = await authenticateByApiKey(authHeader)
  if (!client) {
    return res.status(401).json({ ok: false, error: 'Invalid or deactivated API key' })
  }

  ;(req as unknown as { client: typeof client }).client = client
  next()
}

// ─── Create Checkout Session ────────────────────────────────────────

v1CheckoutRouter.post('/create', requireApiKey, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const { amountEgp, senderHandle, note } = req.body

    const checkout = await createCheckoutSession({
      client,
      amountEgp: Number(amountEgp),
      senderHandle,
      note,
    })

    return res.status(201).json({
      ok: true,
      checkout,
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(400).json({ ok: false, error: error.message })
  }
})

// ─── Check Checkout Status ──────────────────────────────────────────

v1CheckoutRouter.get('/status', requireApiKey, async (req: Request, res: Response) => {
  try {
    const client = (req as unknown as { client: any }).client
    const sessionId = req.query.sessionId as string

    if (!sessionId) {
      return res.status(400).json({ ok: false, error: 'sessionId query parameter is required' })
    }

    const tx = await getCheckoutSession(sessionId)
    if (!tx || tx.clientId !== client.id) {
      return res.status(404).json({ ok: false, error: 'Checkout session not found' })
    }

    return res.json({
      ok: true,
      checkout: {
        sessionId: tx.sessionId,
        status: tx.status,
        amountEgp: tx.amountEgp,
        currency: tx.currency,
        senderHandle: tx.senderHandle,
        recipientHandle: tx.recipientHandle,
        detectedRef: tx.detectedRef,
        detectedAt: tx.detectedAt?.toISOString() ?? null,
        detectedAmountEgp: tx.detectedAmountEgp,
        createdAt: tx.createdAt.toISOString(),
        expiresAt: tx.expiresAt.toISOString(),
      },
    })
  } catch (err: unknown) {
    const error = err as Error
    return res.status(500).json({ ok: false, error: error.message })
  }
})

// ─── Code Snippets Generator ────────────────────────────────────────

v1CheckoutRouter.get('/snippets', requireApiKey, (req: Request, res: Response) => {
  const client = (req as unknown as { client: any }).client
  const host = req.get('host') || 'localhost:3001'
  const protocol = req.protocol
  const baseUrl = `${protocol}://${host}`
  const apiKey = client.apiKey || 'YOUR_API_KEY'

  const curl = `curl -X POST ${baseUrl}/api/v1/checkout/create \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "amountEgp": 150.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1042"
  }'`

  const nodeJs = `const axios = require('axios');

async function createInstapayCheckout() {
  const response = await axios.post('${baseUrl}/api/v1/checkout/create', {
    amountEgp: 150.00,
    senderHandle: 'customer@instapay',
    note: 'Order #1042'
  }, {
    headers: {
      'Authorization': 'Bearer ${apiKey}',
      'Content-Type': 'application/json'
    }
  });

  console.log('Payment URL:', response.data.checkout.checkoutUrl);
}`

  const python = `import requests

url = "${baseUrl}/api/v1/checkout/create"
headers = {
    "Authorization": "Bearer ${apiKey}",
    "Content-Type": "application/json"
}
payload = {
    "amountEgp": 150.00,
    "senderHandle": "customer@instapay",
    "note": "Order #1042"
}

response = requests.post(url, json=payload, headers=headers)
print("Checkout URL:", response.json()["checkout"]["checkoutUrl"])`

  return res.json({
    ok: true,
    snippets: {
      curl,
      javascript: nodeJs,
      python,
    },
  })
})
