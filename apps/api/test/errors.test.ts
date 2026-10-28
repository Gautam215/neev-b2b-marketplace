import { describe, expect, it, vi } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://neev:neev@localhost:5432/neev?schema=public'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-123456'
process.env.PAYMENT_WEBHOOK_SECRET ??= 'test-webhook-secret-123456'
process.env.WEB_ORIGIN ??= 'http://localhost:3000'

// The error middleware imports the Prisma namespace at runtime; stub it here
// so this test does not need a generated Prisma client.
vi.mock('@prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}))

const { HttpError, errorHandler } = await import('../src/middleware/errors.js')

function runHandler(error: unknown) {
  const body: Record<string, unknown> = {}
  let statusCode = 0
  const response = {
    status: (code: number) => {
      statusCode = code
      return response
    },
    json: (payload: Record<string, unknown>) => {
      Object.assign(body, payload)
      return response
    },
  }
  const request = { id: 'req-1', method: 'POST', originalUrl: '/api/v1/assistant/chat' }
  errorHandler(error, request as never, response as never, () => {})
  return { statusCode, body }
}

describe('errorHandler', () => {
  it('keeps a curated HttpError message on a 502', () => {
    const { statusCode, body } = runHandler(new HttpError(502, 'Assistant provider unavailable'))
    expect(statusCode).toBe(502)
    expect(body.error).toBe('Assistant provider unavailable')
  })

  it('still masks an unexpected error as a generic 500', () => {
    const { statusCode, body } = runHandler(new Error('database password is wrong'))
    expect(statusCode).toBe(500)
    expect(body.error).toBe('Internal server error')
    expect(JSON.stringify(body)).not.toContain('database password')
  })
})
