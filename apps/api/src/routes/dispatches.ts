import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { authenticate, requirePermissions } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { dispatchProofSchema, dispatchSchema } from '../schemas/marketplace.js'
import { HttpError } from '../middleware/errors.js'
import { publish } from '../lib/realtime.js'
import { assertTransition, orderTransitions } from '../lib/state-machine.js'
import { enqueueReconciliation } from '../lib/queues.js'

export const dispatchRouter = Router()

dispatchRouter.post('/', authenticate, requirePermissions('dispatch:schedule'), async (request, response) => {
  const input = dispatchSchema.parse(request.body)
  const idempotencyKey = request.header('idempotency-key')?.trim()
  if (!idempotencyKey) throw new HttpError(400, 'Idempotency-Key header is required')
  if (idempotencyKey.length > 128) throw new HttpError(400, 'Idempotency-Key must be 128 characters or fewer')
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { request: true, quote: { include: { supplier: true } } } })
  if (!order) throw new HttpError(404, 'Order not found')
  if (!request.auth!.roles.includes('ops_admin') && order.quote.supplier.organizationId !== request.auth!.organizationId) {
    throw new HttpError(403, 'Order is outside your organization')
  }
  const existing = await prisma.dispatchEvent.findUnique({ where: { orderId_idempotencyKey: { orderId: order.id, idempotencyKey } } })
  if (existing) {
    response.status(200).json({ data: existing, idempotent: true })
    return
  }
  if (order.status !== 'PAYMENT_VERIFIED') throw new HttpError(409, 'Payment must be verified before dispatch')
  assertTransition('order', orderTransitions, order.status, 'DISPATCH_SCHEDULED')

  const result = await prisma.$transaction(async (transaction) => {
    const event = await transaction.dispatchEvent.create({ data: { ...input, idempotencyKey } })
    const updated = await transaction.order.updateMany({ where: { id: order.id, status: 'PAYMENT_VERIFIED' }, data: { status: 'DISPATCH_SCHEDULED' } })
    if (updated.count !== 1) throw new HttpError(409, 'Order changed while dispatch was being scheduled')
    await transaction.auditEvent.create({
      data: { orderId: order.id, actorId: request.auth!.userId, action: 'dispatch.scheduled', requestId: String(request.id), payload: input as Prisma.InputJsonValue },
    })
    return event
  })
  publish(order.quote.supplier.organizationId, 'dispatch.scheduled', result)
  response.status(201).json({ data: result, idempotent: false })
})

dispatchRouter.post('/:dispatchId/proof', authenticate, requirePermissions('dispatch:proof'), async (request, response) => {
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
  if (dispatch.proofUrl) {
    response.status(200).json({ data: dispatch, idempotent: true })
    return
  }
  assertTransition('order', orderTransitions, dispatch.order.status, 'PROOF_RECEIVED')

  const result = await prisma.$transaction(async (transaction) => {
    const updatedDispatch = await transaction.dispatchEvent.update({
      where: { id: dispatch.id },
      data: { proofUrl: input.proofUrl, deliveredPieces: input.deliveredPieces, proofReceivedAt: new Date() },
    })
    const updatedOrder = await transaction.order.updateMany({ where: { id: dispatch.orderId, status: dispatch.order.status }, data: { status: 'PROOF_RECEIVED' } })
    if (updatedOrder.count !== 1) throw new HttpError(409, 'Order changed while proof was being recorded')
    await transaction.auditEvent.create({
      data: { orderId: dispatch.orderId, actorId: request.auth!.userId, action: 'delivery.proof_received', requestId: String(request.id), payload: input as Prisma.InputJsonValue },
    })
    return updatedDispatch
  })
  const job = await enqueueReconciliation(dispatch.orderId)
  publish(dispatch.order.quote.supplier.organizationId, 'delivery.proof_received', result)
  publish(dispatch.order.request.buyerOrgId, 'delivery.proof_received', result)
  response.status(202).json({ data: result, queued: true, jobId: job.id })
})
