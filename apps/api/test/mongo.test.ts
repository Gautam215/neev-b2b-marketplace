import { describe, expect, it } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://neev:neev@localhost:5432/neev?schema=public'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-123456'
process.env.PAYMENT_WEBHOOK_SECRET ??= 'test-webhook-secret-123456'
process.env.WEB_ORIGIN ??= 'http://localhost:3000'

const { decryptMongoDocument, encryptMongoDocument } = await import('../src/lib/mongo.js')

describe('MongoDB field encryption', () => {
  it('round-trips structured data without storing plaintext', () => {
    const key = Buffer.alloc(32, 7)
    const value = { orderId: 'order_demo', payout: { amount: '12500.00', currency: 'INR' }, tags: ['sensitive'] }
    const encrypted = encryptMongoDocument(value, key)

    expect(encrypted.ciphertext).not.toContain('order_demo')
    expect(decryptMongoDocument<typeof value>(encrypted, key)).toEqual(value)
  })

  it('rejects tampering or a wrong key', () => {
    const encrypted = encryptMongoDocument({ secret: 'value' }, Buffer.alloc(32, 7))
    expect(() => decryptMongoDocument(encrypted, Buffer.alloc(32, 8))).toThrow()
  })
})
