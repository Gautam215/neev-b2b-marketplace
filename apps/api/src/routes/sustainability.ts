import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { prisma } from '../lib/prisma.js'
import { sustainabilityMetricSchema, sustainabilityQuerySchema } from '../schemas/marketplace.js'

const decimalString = (value: Prisma.Decimal) => value.toFixed(3)

export const sustainabilityRouter = Router()

sustainabilityRouter.get('/metrics', authenticate, requireRoles('buyer', 'buyer_finance', 'supplier', 'supplier_ops', 'ops_admin'), async (request, response) => {
  const query = sustainabilityQuerySchema.parse(request.query)
  const to = query.to ?? new Date()
  const from = query.from ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)
  const metrics = await prisma.sustainabilityMetric.findMany({
    where: { organizationId: request.auth!.organizationId, periodStart: { gte: from }, periodEnd: { lte: to } },
    orderBy: { periodStart: 'asc' },
  })
  const baselineKg = metrics.reduce((total, metric) => total.add(metric.baselineKg), new Prisma.Decimal(0))
  const actualKg = metrics.reduce((total, metric) => total.add(metric.actualKg), new Prisma.Decimal(0))
  const reducedKg = metrics.reduce((total, metric) => total.add(metric.reducedKg), new Prisma.Decimal(0))
  const reductionPct = baselineKg.isZero() ? new Prisma.Decimal(0) : reducedKg.div(baselineKg).mul(100)
  response.json({
    data: {
      period: { from: from.toISOString(), to: to.toISOString() },
      totals: { baselineKg: decimalString(baselineKg), actualKg: decimalString(actualKg), reducedKg: decimalString(reducedKg), reductionPct: reductionPct.toFixed(2) },
      count: metrics.length,
      trend: metrics.map((metric) => ({ periodStart: metric.periodStart, periodEnd: metric.periodEnd, baselineKg: decimalString(metric.baselineKg), actualKg: decimalString(metric.actualKg), reducedKg: decimalString(metric.reducedKg), recycledSharePct: metric.recycledSharePct.toFixed(2), methodology: metric.methodology })),
    },
  })
})

sustainabilityRouter.post('/metrics', authenticate, requireRoles('supplier_ops', 'ops_admin'), async (request, response) => {
  const input = sustainabilityMetricSchema.parse(request.body)
  if (input.orderId) {
    const order = await prisma.order.findUnique({ where: { id: input.orderId }, include: { quote: { include: { supplier: true } } } })
    if (!order) throw new HttpError(404, 'Order not found')
    if (!request.auth!.roles.includes('ops_admin') && order.quote.supplier.organizationId !== request.auth!.organizationId) throw new HttpError(403, 'Order is outside your organization')
  }
  const reducedKg = new Prisma.Decimal(input.baselineKg).sub(input.actualKg)
  const metric = await prisma.sustainabilityMetric.upsert({
    where: { organizationId_periodStart_periodEnd: { organizationId: request.auth!.organizationId, periodStart: input.periodStart, periodEnd: input.periodEnd } },
    create: { ...input, organizationId: request.auth!.organizationId, reducedKg },
    update: { ...input, reducedKg },
  })
  response.status(201).json({ data: { ...metric, baselineKg: decimalString(metric.baselineKg), actualKg: decimalString(metric.actualKg), reducedKg: decimalString(metric.reducedKg), recycledSharePct: metric.recycledSharePct.toFixed(2) } })
})
