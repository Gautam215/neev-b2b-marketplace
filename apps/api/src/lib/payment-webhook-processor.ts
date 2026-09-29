import { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'
import { publish } from './realtime.js'
import { assertTransition, orderTransitions } from './state-machine.js'
import type { PaymentWebhookJob } from './queues.js'

const asPayload = (data: PaymentWebhookJob): Prisma.InputJsonValue => ({
  ...data,
}) as Prisma.InputJsonValue

export async function processPaymentWebhook(data: PaymentWebhookJob) {
  const existing = await prisma.paymentWebhookEvent.findUnique({ where: { gateway_eventId: { gateway: data.gateway, eventId: data.eventId } } })
  if (existing?.status === 'PROCESSED' || existing?.status === 'IGNORED' || existing?.status === 'FAILED') {
    return { status: existing.status.toLowerCase(), duplicate: true }
  }

  const ledger = existing ?? await prisma.paymentWebhookEvent.create({
    data: {
      gateway: data.gateway,
      eventId: data.eventId,
      paymentIntentId: data.paymentIntentId,
      orderId: data.orderId,
      providerRef: data.providerRef,
      payload: asPayload(data),
    },
  })

  const intent = await prisma.paymentIntent.findUnique({
    where: { id: data.paymentIntentId },
    include: { order: { include: { request: true, quote: { include: { supplier: true } } } } },
  })
  if (!intent || intent.orderId !== data.orderId) {
    await prisma.paymentWebhookEvent.update({ where: { id: ledger.id }, data: { status: 'FAILED', error: 'Payment intent or order does not match', processedAt: new Date() } })
    return { status: 'failed', duplicate: false }
  }

  if (data.eventType === 'payment.failed') {
    await prisma.$transaction([
      prisma.paymentWebhookEvent.update({ where: { id: ledger.id }, data: { status: 'IGNORED', processedAt: new Date() } }),
      prisma.auditEvent.create({ data: { orderId: intent.orderId, actorId: 'system:webhook', action: 'payment.failed', requestId: `webhook:${data.eventId}`, payload: asPayload(data) } }),
    ])
    return { status: 'ignored', duplicate: false }
  }

  const expectedAmount = new Prisma.Decimal(data.amount)
  if (!intent.amount.equals(expectedAmount) || intent.currency !== data.currency || intent.gateway !== data.gateway) {
    await prisma.paymentWebhookEvent.update({ where: { id: ledger.id }, data: { status: 'FAILED', error: 'Payment amount, currency, or gateway does not match', processedAt: new Date() } })
    return { status: 'failed', duplicate: false }
  }

  if (intent.verifiedAt && intent.order.status === 'PAYMENT_VERIFIED') {
    await prisma.paymentWebhookEvent.update({ where: { id: ledger.id }, data: { status: 'PROCESSED', processedAt: new Date() } })
    return { status: 'processed', duplicate: true }
  }
  assertTransition('order', orderTransitions, intent.order.status, 'PAYMENT_VERIFIED')

  await prisma.$transaction(async (transaction) => {
    await transaction.paymentIntent.update({ where: { id: intent.id }, data: { providerRef: data.providerRef, verifiedAt: new Date() } })
    const updated = await transaction.order.updateMany({ where: { id: intent.orderId, status: 'PAYMENT_PENDING' }, data: { status: 'PAYMENT_VERIFIED' } })
    if (updated.count !== 1) throw new Error('Order changed while payment was being verified')
    await transaction.paymentWebhookEvent.update({ where: { id: ledger.id }, data: { status: 'PROCESSED', processedAt: new Date() } })
    await transaction.auditEvent.create({ data: { orderId: intent.orderId, actorId: 'system:webhook', action: 'payment.verified', requestId: `webhook:${data.eventId}`, payload: asPayload(data) } })
  })

  publish(intent.order.request.buyerOrgId, 'payment.verified', { orderId: intent.orderId, providerRef: data.providerRef })
  publish(intent.order.quote.supplier.organizationId, 'payment.verified', { orderId: intent.orderId, providerRef: data.providerRef })
  return { status: 'processed', duplicate: false }
}

export async function processReconciliation(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { request: true, quote: { include: { supplier: true } }, dispatchEvents: { orderBy: { createdAt: 'desc' }, take: 1 } },
  })
  if (!order) return { status: 'missing' as const }
  if (order.status === 'RECONCILED') return { status: 'reconciled' as const, duplicate: true }
  if (order.status !== 'PROOF_RECEIVED') throw new Error('Order is not ready for reconciliation')
  const proof = order.dispatchEvents[0]
  if (!proof?.deliveredPieces || !proof.proofUrl) throw new Error('Delivery proof is incomplete')

  const nextStatus = proof.deliveredPieces === order.request.quantity ? 'RECONCILED' : 'DISPUTED'
  assertTransition('order', orderTransitions, order.status, nextStatus)
  await prisma.$transaction(async (transaction) => {
    const updated = await transaction.order.updateMany({ where: { id: order.id, status: 'PROOF_RECEIVED' }, data: { status: nextStatus } })
    if (updated.count !== 1) throw new Error('Order changed while reconciliation was running')
    await transaction.auditEvent.create({
      data: {
        orderId: order.id,
        actorId: 'system:reconciliation',
        action: nextStatus === 'RECONCILED' ? 'order.reconciled' : 'order.disputed',
        requestId: `reconciliation:${order.id}`,
        payload: { deliveredPieces: proof.deliveredPieces, requestedPieces: order.request.quantity, proofUrl: proof.proofUrl },
      },
    })
  })

  publish(order.request.buyerOrgId, `order.${nextStatus.toLowerCase()}`, { orderId: order.id })
  publish(order.quote.supplier.organizationId, `order.${nextStatus.toLowerCase()}`, { orderId: order.id })
  return { status: nextStatus.toLowerCase() as 'reconciled' | 'disputed', duplicate: false }
}
