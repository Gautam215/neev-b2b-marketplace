import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { prisma } from '../lib/prisma.js'
import { paymentIntentSchema } from '../schemas/marketplace.js'

export const paymentIntentRouter = Router()

paymentIntentRouter.post('/', authenticate, requireRoles('buyer_finance', 'ops_admin'), async (request, response) => {
  const input = paymentIntentSchema.parse(request.body)
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { request: true, quote: true, paymentIntent: true },
  })
  if (!order) throw new HttpError(404, 'Order not found')
  if (!request.auth!.roles.includes('ops_admin') && order.request.buyerOrgId !== request.auth!.organizationId) {
    throw new HttpError(403, 'Order is outside your organization')
  }
  if (order.paymentIntent) {
    response.json({ data: { ...order.paymentIntent, amount: order.paymentIntent.amount.toString() }, idempotent: true })
    return
  }
  if (order.status !== 'PAYMENT_PENDING') throw new HttpError(409, 'Order is not awaiting payment')

  const amount = new Prisma.Decimal(order.quote.pricePerPiece).mul(order.request.quantity).add(order.quote.freight)
  const paymentIntent = await prisma.$transaction(async (transaction) => {
    const created = await transaction.paymentIntent.create({
      data: { orderId: order.id, gateway: input.gateway, amount, currency: 'INR' },
    })
    await transaction.auditEvent.create({
      data: {
        orderId: order.id,
        actorId: request.auth!.userId,
        action: 'payment_intent.created',
        requestId: String(request.id),
        payload: { gateway: input.gateway, amount: amount.toString(), currency: 'INR' },
      },
    })
    return created
  })
  response.status(201).json({ data: { ...paymentIntent, amount: paymentIntent.amount.toString() }, idempotent: false })
})
