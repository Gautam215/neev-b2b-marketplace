import { describe, expect, it } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://neev:neev@localhost:5432/neev?schema=public'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-123456'
process.env.PAYMENT_WEBHOOK_SECRET ??= 'test-webhook-secret-123456'
process.env.WEB_ORIGIN ??= 'http://localhost:3000'

const { hashIdempotencyValue } = await import('../src/middleware/idempotency.js')

describe('idempotency request fingerprints', () => {
  it('is stable when object property order changes', () => {
    expect(hashIdempotencyValue({ quantity: 1000, deliveryArea: 'Noida' })).toBe(hashIdempotencyValue({ deliveryArea: 'Noida', quantity: 1000 }))
  })

  it('distinguishes changed payloads and dates', () => {
    expect(hashIdempotencyValue({ quantity: 1000 })).not.toBe(hashIdempotencyValue({ quantity: 1001 }))
    expect(hashIdempotencyValue({ targetDate: new Date('2026-01-01T00:00:00.000Z') })).toBe(hashIdempotencyValue({ targetDate: '2026-01-01T00:00:00.000Z' }))
  })
})
