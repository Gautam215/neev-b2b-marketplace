import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { authenticate, requirePermissions } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { dispatchProofSchema, dispatchSchema } from '../schemas/marketplace.js'
import { HttpError } from '../middleware/errors.js'
import { publish } from '../lib/realtime.js'
import { recordAudit } from '../lib/audit.js'
import { assertTransition, orderTransitions } from '../lib/state-machine.js'
import { enqueueReconciliation } from '../lib/queues.js'
import { hashIdempotencyValue, requireIdempotency } from '../middleware/idempotency.js'

export const dispatchRouter = Router()

dispatchRouter.post('/', authenticate, requirePermissions('dispatch:schedule'), requireIdempotency, async (request, response) => {
  const input = dispatchSchema.parse(request.body)
  const idempotencyKey = request.header('idempotency-key')?.trim()
  if (!idempotencyKey) throw new HttpError(400, 'Idempotency-Key header is required')
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { request: true, quote: { include: { supplier: true } } } })
  if (!order) throw new HttpError(404, 'Order not found')
  if (!request.auth!.roles.includes('ops_admin') && order.quote.supplier.organizationId !== request.auth!.organizationId) {
    throw new HttpError(403, 'Order is outside your organization')
  }
  const existing = await prisma.dispatchEvent.findUnique({ where: { orderId_idempotencyKey: { orderId: order.id, idempotencyKey } } })
  if (existing) {
    if (existing.idempotencyHash && existing.idempotencyHash !== hashIdempotencyValue(input)) throw new HttpError(409, 'Idempotency-Key was already used with different data')
    response.status(200).json({ data: existing, idempotent: true })
    return
  }
  if (order.status !== 'PAYMENT_VERIFIED') throw new HttpError(409, 'Payment must be verified before dispatch')
  assertTransition('order', orderTransitions, order.status, 'DISPATCH_SCHEDULED')

  const result = await prisma.$transaction(async (transaction) => {
     const event = await transaction.dispatchEvent.create({ data: { ...input, idempotencyKey, idempotencyHash: hashIdempotencyValue(input) } })
    const updated = await transaction.order.updateMany({ where: { id: order.id, status: 'PAYMENT_VERIFIED' }, data: { status: 'DISPATCH_SCHEDULED' } })
    if (updated.count !== 1) throw new HttpError(409, 'Order changed while dispatch was being scheduled')
    await recordAudit(transaction, {
      organizationId: order.request.buyerOrgId,
      orderId: order.id,
      actorId: request.auth!.userId,
      action: 'dispatch.scheduled',
      entityType: 'DispatchEvent',
      entityId: event.id,
      requestId: String(request.id),
      after: { orderStatus: 'DISPATCH_SCHEDULED' },
      payload: input as Prisma.InputJsonValue,
    })
    return event
  })
  publish(order.quote.supplier.organizationId, 'dispatch.scheduled', result)
  response.status(201).json({ data: result, idempotent: false })
})

dispatchRouter.post('/:dispatchId/in-transit', authenticate, requirePermissions('dispatch:transit'), requireIdempotency, async (request, response) => {
  const dispatchId = request.params.dispatchId
  if (!dispatchId || Array.isArray(dispatchId)) throw new HttpError(400, 'Dispatch id is required')
  const dispatch = await prisma.dispatchEvent.findUnique({ where: { id: dispatchId }, include: { order: { include: { request: true, quote: { include: { supplier: true } } } } } })
  if (!dispatch) throw new HttpError(404, 'Dispatch event not found')
  if (!request.auth!.roles.includes('ops_admin') && dispatch.order.quote.supplier.organizationId !== request.auth!.organizationId) throw new HttpError(403, 'Dispatch is outside your organization')
  assertTransition('order', orderTransitions, dispatch.order.status, 'IN_TRANSIT')
  const result = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.order.updateMany({ where: { id: dispatch.orderId, status: dispatch.order.status }, data: { status: 'IN_TRANSIT' } })
    if (updated.count !== 1) throw new HttpError(409, 'Order changed while dispatch was being marked in transit')
    const order = await transaction.order.findUniqueOrThrow({ where: { id: dispatch.orderId } })
    await recordAudit(transaction, {
      organizationId: dispatch.order.request.buyerOrgId,
      orderId: dispatch.orderId,
      actorId: request.auth!.userId,
      action: 'dispatch.in_transit',
      entityType: 'Order',
      entityId: dispatch.orderId,
      requestId: String(request.id),
      before: { status: dispatch.order.status },
      after: { status: order.status },
      payload: { dispatchId: dispatch.id },
    })
    return order
  })
  publish(dispatch.order.request.buyerOrgId, 'dispatch.in_transit', result)
  publish(dispatch.order.quote.supplier.organizationId, 'dispatch.in_transit', result)
  response.json({ data: result, idempotent: false })
})

dispatchRouter.post('/:dispatchId/proof', authenticate, requirePermissions('dispatch:proof'), requireIdempotency, async (request, response) => {
  const dispatchId = request.params.dispatchId
  if (!dispatchId || Array.isArray(dispatchId)) throw new HttpError(400, 'Dispatch id is required')
  const input = dispatchProofSchema.parse(request.body)
  const dispatch = await prisma.dispatchEvent.findUnique({
    where: { id: dispatchId },
    include: { order: { include: { request: true, quote: { include: { supplier: true } } } } },
  })
  if (!dispatch) throw new HttpError(404, 'Dispatch event not found')
  const isOps = request.auth!.roles.includes('ops_admin')
  if (!isOps && dispatch.order.quote.supplier.organizationId !== request.auth!.organizationId) throw new HttpError(403, 'Dispatch is outside your organization')
  if (dispatch.proofUrl) throw new HttpError(409, 'Delivery proof has already been recorded')
  assertTransition('order', orderTransitions, dispatch.order.status, 'PROOF_RECEIVED')

  const result = await prisma.$transaction(async (transaction) => {
    const updatedDispatch = await transaction.dispatchEvent.update({
      where: { id: dispatch.id },
      data: { proofUrl: input.proofUrl, deliveredPieces: input.deliveredPieces, proofReceivedAt: new Date() },
    })
    const updatedOrder = await transaction.order.updateMany({ where: { id: dispatch.orderId, status: dispatch.order.status }, data: { status: 'PROOF_RECEIVED' } })
    if (updatedOrder.count !== 1) throw new HttpError(409, 'Order changed while proof was being recorded')
    await recordAudit(transaction, {
      organizationId: dispatch.order.request.buyerOrgId,
      orderId: dispatch.orderId,
      actorId: request.auth!.userId,
      action: 'delivery.proof_received',
      entityType: 'DispatchEvent',
      entityId: dispatch.id,
      requestId: String(request.id),
      after: { orderStatus: 'PROOF_RECEIVED', deliveredPieces: input.deliveredPieces },
      payload: input as Prisma.InputJsonValue,
    })
    return updatedDispatch
  })
  const job = await enqueueReconciliation(dispatch.orderId)
  publish(dispatch.order.quote.supplier.organizationId, 'delivery.proof_received', result)
  publish(dispatch.order.request.buyerOrgId, 'delivery.proof_received', result)
  response.status(202).json({ data: result, queued: true, jobId: job.id })
})
