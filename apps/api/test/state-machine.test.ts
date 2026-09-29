import { describe, expect, it } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://neev:neev@localhost:5432/neev?schema=public'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-123456'
process.env.PAYMENT_WEBHOOK_SECRET ??= 'test-webhook-secret-123456'
process.env.WEB_ORIGIN ??= 'http://localhost:3000'

const { HttpError } = await import('../src/middleware/errors.js')
const { assertTransition, canTransition, orderTransitions, quoteRequestTransitions, quoteTransitions } = await import('../src/lib/state-machine.js')

describe('quote request state transitions', () => {
  it.each([
    ['REQUESTED', 'QUOTED'],
    ['REQUESTED', 'ACCEPTED'],
    ['REQUESTED', 'EXPIRED'],
    ['REQUESTED', 'CANCELLED'],
    ['QUOTED', 'ACCEPTED'],
    ['QUOTED', 'EXPIRED'],
    ['QUOTED', 'CANCELLED'],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransition(quoteRequestTransitions, from as never, to as never)).toBe(true)
  })

  it.each([
    ['ACCEPTED', 'REQUESTED'],
    ['ACCEPTED', 'CANCELLED'],
    ['EXPIRED', 'ACCEPTED'],
    ['CANCELLED', 'QUOTED'],
  ])('blocks %s -> %s', (from, to) => {
    expect(canTransition(quoteRequestTransitions, from as never, to as never)).toBe(false)
  })
})

describe('quote state transitions', () => {
  it.each([
    ['DRAFT', 'ACTIVE'],
    ['DRAFT', 'REJECTED'],
    ['DRAFT', 'EXPIRED'],
    ['ACTIVE', 'ACCEPTED'],
    ['ACTIVE', 'REJECTED'],
    ['ACTIVE', 'EXPIRED'],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransition(quoteTransitions, from as never, to as never)).toBe(true)
  })

  it.each([
    ['ACCEPTED', 'ACTIVE'],
    ['ACCEPTED', 'REJECTED'],
    ['REJECTED', 'ACTIVE'],
    ['EXPIRED', 'ACTIVE'],
  ])('blocks %s -> %s', (from, to) => {
    expect(canTransition(quoteTransitions, from as never, to as never)).toBe(false)
  })
})

describe('order state transitions', () => {
  it.each([
    ['PAYMENT_PENDING', 'PAYMENT_VERIFIED'],
    ['PAYMENT_PENDING', 'DISPUTED'],
    ['PAYMENT_VERIFIED', 'DISPATCH_SCHEDULED'],
    ['PAYMENT_VERIFIED', 'DISPUTED'],
    ['DISPATCH_SCHEDULED', 'IN_TRANSIT'],
    ['DISPATCH_SCHEDULED', 'PROOF_RECEIVED'],
    ['DISPATCH_SCHEDULED', 'DISPUTED'],
    ['IN_TRANSIT', 'PROOF_RECEIVED'],
    ['IN_TRANSIT', 'DISPUTED'],
    ['PROOF_RECEIVED', 'RECONCILED'],
    ['PROOF_RECEIVED', 'DISPUTED'],
    ['DISPUTED', 'RECONCILED'],
  ])('allows %s -> %s', (from, to) => {
    expect(canTransition(orderTransitions, from as never, to as never)).toBe(true)
  })

  it.each([
    ['PAYMENT_VERIFIED', 'PAYMENT_PENDING'],
    ['DISPATCH_SCHEDULED', 'PAYMENT_VERIFIED'],
    ['IN_TRANSIT', 'PAYMENT_PENDING'],
    ['PROOF_RECEIVED', 'IN_TRANSIT'],
    ['RECONCILED', 'DISPUTED'],
    ['RECONCILED', 'PAYMENT_PENDING'],
    ['DISPUTED', 'PAYMENT_VERIFIED'],
  ])('blocks %s -> %s', (from, to) => {
    expect(canTransition(orderTransitions, from as never, to as never)).toBe(false)
  })

  it('returns a conflict with transition details', () => {
    expect(() => assertTransition('order', orderTransitions, 'RECONCILED', 'PAYMENT_PENDING')).toThrow(HttpError)
    try {
      assertTransition('order', orderTransitions, 'RECONCILED', 'PAYMENT_PENDING')
    } catch (error) {
      expect(error).toMatchObject({ status: 409, details: { from: 'RECONCILED', to: 'PAYMENT_PENDING' } })
    }
  })

  it('does not allow self-transitions for any order state', () => {
    for (const state of Object.keys(orderTransitions)) {
      expect(canTransition(orderTransitions, state as never, state as never)).toBe(false)
    }
  })

  it.each([
    ['PAYMENT_PENDING', ['PAYMENT_VERIFIED', 'DISPUTED']],
    ['PAYMENT_VERIFIED', ['DISPATCH_SCHEDULED', 'DISPUTED']],
    ['DISPATCH_SCHEDULED', ['IN_TRANSIT', 'PROOF_RECEIVED', 'DISPUTED']],
    ['IN_TRANSIT', ['PROOF_RECEIVED', 'DISPUTED']],
    ['PROOF_RECEIVED', ['RECONCILED', 'DISPUTED']],
    ['DISPUTED', ['RECONCILED']],
    ['RECONCILED', []],
  ])('keeps the complete outgoing transition set for %s', (from, expected) => {
    expect(orderTransitions[from as keyof typeof orderTransitions]).toEqual(expected)
  })

  it.each(['ACCEPTED', 'EXPIRED', 'CANCELLED'])('treats terminal quote requests as immutable: %s', (state) => {
    expect(quoteRequestTransitions[state as keyof typeof quoteRequestTransitions]).toEqual([])
  })

  it.each(['ACCEPTED', 'REJECTED', 'EXPIRED'])('treats terminal quotes as immutable: %s', (state) => {
    expect(quoteTransitions[state as keyof typeof quoteTransitions]).toEqual([])
  })
})
