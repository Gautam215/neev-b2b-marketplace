import { Router } from 'express'
import express from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'
import { HttpError } from '../middleware/errors.js'
import { paymentWebhookSchema } from '../schemas/marketplace.js'
import { enqueuePaymentWebhook } from '../lib/queues.js'

export const paymentRouter = Router()

paymentRouter.post('/:gateway/webhook', express.raw({ type: 'application/json', limit: env.MAX_WEBHOOK_BODY_BYTES }), async (request, response) => {
   const gateway = request.params.gateway
   if (gateway !== 'stripe' && gateway !== 'razorpay') throw new HttpError(400, 'Unsupported payment gateway')
   const signature = request.header('x-gateway-signature')
   if (!signature) throw new HttpError(400, 'Gateway signature is required')
   const rawBody = Buffer.isBuffer(request.body) ? request.body : Buffer.from(request.body ?? '')
   const expected = createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(rawBody).digest('hex')
   const supplied = Buffer.from(signature, 'utf8')
   const expectedBuffer = Buffer.from(expected, 'utf8')
   if (supplied.length !== expectedBuffer.length || !timingSafeEqual(supplied, expectedBuffer)) throw new HttpError(401, 'Invalid gateway signature')

   let parsedBody: unknown
   try {
     parsedBody = JSON.parse(rawBody.toString('utf8'))
   } catch {
     throw new HttpError(400, 'Malformed webhook body')
   }
   const input = paymentWebhookSchema.parse(parsedBody)
   if (Math.abs(Date.now() - input.occurredAt.getTime()) > env.PAYMENT_WEBHOOK_TOLERANCE_SECONDS * 1000) throw new HttpError(400, 'Webhook timestamp is outside the accepted window')
    const job = await enqueuePaymentWebhook({ ...input, gateway, occurredAt: input.occurredAt.toISOString() })
   response.status(202).json({ accepted: true, queued: true, gateway, eventId: input.eventId, jobId: job.id })
 })
