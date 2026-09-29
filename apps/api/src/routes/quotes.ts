import { Router } from 'express'
import { authenticate, requirePermissions } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { prisma } from '../lib/prisma.js'
import { publish } from '../lib/realtime.js'
import { recordAudit } from '../lib/audit.js'
import { quoteAcceptSchema } from '../schemas/marketplace.js'
import { assertTransition, quoteRequestTransitions, quoteTransitions } from '../lib/state-machine.js'
import { requireIdempotency } from '../middleware/idempotency.js'

export const quoteRouter = Router()

quoteRouter.post('/:quoteId/accept', authenticate, requirePermissions('quotes:accept:buyer', 'quotes:accept:supplier'), requireIdempotency, async (request, response) => {
  const quoteId = request.params.quoteId
  if (!quoteId || Array.isArray(quoteId)) throw new HttpError(400, 'Quote id is required')
  const input = quoteAcceptSchema.parse(request.body)
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { request: true, supplier: true, order: true },
  })
  if (!quote) throw new HttpError(404, 'Quote not found')

   const isOps = request.auth!.roles.includes('ops_admin')
   const ownsBuyerRequest = quote.request.buyerOrgId === request.auth!.organizationId
   const ownsSupplier = quote.supplier.organizationId === request.auth!.organizationId
   const canAcceptAsBuyer = ownsBuyerRequest && request.auth!.roles.some((role) => role === 'buyer' || role === 'buyer_finance')
   const canAcceptAsSupplier = ownsSupplier && request.auth!.roles.includes('supplier')
   if (!isOps && !canAcceptAsBuyer && !canAcceptAsSupplier) throw new HttpError(403, 'Quote is outside your organization or role')
  if (quote.order) {
    response.json({ data: quote.order, idempotent: true })
    return
  }
   if (quote.status !== 'ACTIVE') throw new HttpError(409, 'Only an active quote can be accepted')
   if (quote.expiresAt <= new Date()) throw new HttpError(409, 'Quote has expired')
   if (quote.version !== input.quoteVersion) throw new HttpError(409, 'Quote version is stale', { currentVersion: quote.version })
   assertTransition('quote request', quoteRequestTransitions, quote.request.status, 'ACCEPTED')
   assertTransition('quote', quoteTransitions, quote.status, 'ACCEPTED')

  const result = await prisma.$transaction(async (transaction) => {
    const accepted = await transaction.quote.updateMany({
      where: { id: quote.id, version: input.quoteVersion, status: 'ACTIVE' },
      data: { status: 'ACCEPTED' },
    })
    if (accepted.count !== 1) throw new HttpError(409, 'Quote changed while you were accepting it')
    const acceptedRequest = await transaction.quoteRequest.updateMany({ where: { id: quote.requestId, status: quote.request.status }, data: { status: 'ACCEPTED' } })
    if (acceptedRequest.count !== 1) throw new HttpError(409, 'Quote request changed while you were accepting the quote')
    const order = await transaction.order.create({ data: { requestId: quote.requestId, quoteId: quote.id } })
    await recordAudit(transaction, {
      organizationId: quote.request.buyerOrgId,
      orderId: order.id,
      actorId: request.auth!.userId,
      action: 'quote.accepted',
      entityType: 'Order',
      entityId: order.id,
      requestId: String(request.id),
      after: { quoteStatus: 'ACCEPTED', quoteRequestStatus: 'ACCEPTED', orderStatus: order.status },
      payload: { quoteId: quote.id, quoteVersion: quote.version },
    })
    return order
  })

  publish(quote.request.buyerOrgId, 'quote.accepted', result)
  publish(quote.supplier.organizationId, 'quote.accepted', result)
  response.status(201).json({ data: result, idempotent: false })
})
