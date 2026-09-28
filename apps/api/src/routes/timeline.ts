import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { HttpError } from '../middleware/errors.js'

export const timelineRouter = Router()

timelineRouter.get('/:orderId/timeline', authenticate, async (request, response) => {
  const orderId = request.params.orderId
  if (!orderId || Array.isArray(orderId)) throw new HttpError(400, 'Order id is required')
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      request: true,
      quote: { include: { supplier: true } },
      paymentIntent: true,
      dispatchEvents: { orderBy: { createdAt: 'asc' } },
      auditEvents: { orderBy: { occurredAt: 'asc' } },
    },
  })
  if (!order) throw new HttpError(404, 'Order not found')
  const canView = request.auth!.roles.includes('ops_admin') || order.request.buyerOrgId === request.auth!.organizationId || order.quote.supplier.organizationId === request.auth!.organizationId
  if (!canView) throw new HttpError(403, 'Order is outside your organization')
  response.json({ data: order })
})
