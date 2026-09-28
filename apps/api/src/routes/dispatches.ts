import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { dispatchSchema } from '../schemas/marketplace.js'
import { HttpError } from '../middleware/errors.js'
import { publish } from '../lib/realtime.js'

export const dispatchRouter = Router()

dispatchRouter.post('/', authenticate, requireRoles('supplier_ops', 'ops_admin'), async (request, response) => {
  const input = dispatchSchema.parse(request.body)
  const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { request: true, quote: { include: { supplier: true } } } })
  if (!order) throw new HttpError(404, 'Order not found')
  if (!request.auth!.roles.includes('ops_admin') && order.quote.supplier.organizationId !== request.auth!.organizationId) {
    throw new HttpError(403, 'Order is outside your organization')
  }
  if (order.status !== 'PAYMENT_VERIFIED') throw new HttpError(409, 'Payment must be verified before dispatch')

  const result = await prisma.$transaction(async (transaction) => {
    const event = await transaction.dispatchEvent.create({ data: input })
    await transaction.order.update({ where: { id: order.id }, data: { status: 'DISPATCH_SCHEDULED' } })
    await transaction.auditEvent.create({
      data: { orderId: order.id, actorId: request.auth!.userId, action: 'dispatch.scheduled', requestId: String(request.id), payload: input as Prisma.InputJsonValue },
    })
    return event
  })
  publish(order.quote.supplier.organizationId, 'dispatch.scheduled', result)
  response.status(201).json({ data: result })
})
