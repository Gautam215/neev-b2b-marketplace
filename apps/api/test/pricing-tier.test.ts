import { describe, expect, it } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://neev:neev@localhost:5432/neev?schema=public'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-123456'
process.env.PAYMENT_WEBHOOK_SECRET ??= 'test-webhook-secret-123456'
process.env.WEB_ORIGIN ??= 'http://localhost:3000'

const { selectPricingTier } = await import('../src/lib/pricing-rules.js')

describe('selectPricingTier', () => {
  it('picks the highest qualifying tier when tiers are already sorted', () => {
    expect(selectPricingTier([
      { minQuantity: 1000, discountBps: 0 },
      { minQuantity: 5000, discountBps: 200 },
      { minQuantity: 25000, discountBps: 700 },
    ], 25000)).toMatchObject({ minQuantity: 25000, discountBps: 700 })
  })

  it('falls back to the smallest tier, not the first cached tier, when no tier qualifies', () => {
    expect(selectPricingTier([
      { minQuantity: 10000, discountBps: 450 },
      { minQuantity: 5000, discountBps: 200 },
    ], 1000)).toMatchObject({ minQuantity: 5000, discountBps: 200 })
  })
})
