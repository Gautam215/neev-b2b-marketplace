import type { OrderStatus, QuoteRequestStatus, QuoteStatus } from '@prisma/client'
import { HttpError } from '../middleware/errors.js'

type StateMap<T extends string> = Record<T, readonly T[]>

export const quoteRequestTransitions: StateMap<QuoteRequestStatus> = {
  REQUESTED: ['QUOTED', 'ACCEPTED', 'EXPIRED', 'CANCELLED'],
  QUOTED: ['ACCEPTED', 'EXPIRED', 'CANCELLED'],
  ACCEPTED: [],
  EXPIRED: [],
  CANCELLED: [],
}

export const quoteTransitions: StateMap<QuoteStatus> = {
  DRAFT: ['ACTIVE', 'REJECTED', 'EXPIRED'],
  ACTIVE: ['ACCEPTED', 'REJECTED', 'EXPIRED'],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
}

export const orderTransitions: StateMap<OrderStatus> = {
  PAYMENT_PENDING: ['PAYMENT_VERIFIED', 'DISPUTED'],
  PAYMENT_VERIFIED: ['DISPATCH_SCHEDULED', 'DISPUTED'],
  DISPATCH_SCHEDULED: ['IN_TRANSIT', 'PROOF_RECEIVED', 'DISPUTED'],
  IN_TRANSIT: ['PROOF_RECEIVED', 'DISPUTED'],
  PROOF_RECEIVED: ['RECONCILED', 'DISPUTED'],
  RECONCILED: [],
  DISPUTED: ['RECONCILED'],
}

export function canTransition<T extends string>(transitions: StateMap<T>, from: T, to: T) {
  return transitions[from]?.includes(to) ?? false
}

export function assertTransition<T extends string>(name: string, transitions: StateMap<T>, from: T, to: T) {
  if (!canTransition(transitions, from, to)) throw new HttpError(409, `Invalid ${name} transition`, { from, to })
}
