import { describe, expect, it } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://neev:neev@localhost:5432/neev?schema=public'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-123456'
process.env.PAYMENT_WEBHOOK_SECRET ??= 'test-webhook-secret-123456'
process.env.WEB_ORIGIN ??= 'http://localhost:3000'

const { paymentWebhookJobId, queueNames, reconciliationJobId } = await import('../src/lib/queues.js')

describe('BullMQ job identity', () => {
  it('keeps payment events unique by gateway and provider event id', () => {
    expect(paymentWebhookJobId({ gateway: 'stripe', eventId: 'evt_1' })).toBe('payment:stripe:evt_1')
    expect(paymentWebhookJobId({ gateway: 'razorpay', eventId: 'evt_1' })).not.toBe(paymentWebhookJobId({ gateway: 'stripe', eventId: 'evt_1' }))
  })

  it('keeps repeated reconciliation requests on one order unique', () => {
    expect(reconciliationJobId('order_1')).toBe('reconcile:order_1')
    expect(reconciliationJobId('order_1')).toBe(reconciliationJobId('order_1'))
  })

  it('uses separate queues for payment webhooks and reconciliation', () => {
    expect(queueNames.paymentWebhooks).not.toBe(queueNames.reconciliation)
  })

  it('uses names that make queue ownership clear in Redis', () => {
    expect(queueNames.paymentWebhooks).toMatch(/^neev\./)
    expect(queueNames.reconciliation).toMatch(/^neev\./)
  })

  it('does not put raw payment data in a job id', () => {
    const jobId = paymentWebhookJobId({ gateway: 'stripe', eventId: 'evt_1' })
    expect(jobId).not.toContain('amount')
    expect(jobId).not.toContain('currency')
  })
})
