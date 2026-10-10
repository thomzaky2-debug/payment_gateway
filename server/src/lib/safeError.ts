import { Response } from 'express'

/**
 * Determines if the current environment is development or test.
 * Any other environment (production, staging, or undefined) fails closed.
 */
export function isDevOrTest(): boolean {
  const env = (process.env.NODE_ENV || '').toLowerCase().trim()
  return env === 'development' || env === 'test'
}

/**
 * Returns a sanitized error message for client responses.
 * Fails closed: Only returns raw error.message if explicitly in development or test mode.
 */
export function safeErrorMessage(err: unknown, fallback = 'Internal server error'): string {
  if (isDevOrTest() && err instanceof Error && err.message) {
    return err.message
  }
  return fallback
}

/**
 * Sends a standardized 500 Internal Server Error response.
 * Fails closed outside development/test.
 */
export function sendInternalError(
  res: Response,
  err: unknown,
  fallback = 'Internal server error'
): Response {
  console.error('[Internal Error]:', err)
  return res.status(500).json({
    ok: false,
    error: safeErrorMessage(err, fallback),
  })
}
