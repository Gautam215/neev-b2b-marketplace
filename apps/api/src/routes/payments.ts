import { Router } from 'express'
import express from 'express'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../config/env.js'
import { HttpError } from '../middleware/errors.js'

export const paymentRouter = Router()

paymentRouter.post('/:gateway/webhook', express.raw({ type: 'application/json', limit: env.MAX_WEBHOOK_BODY_BYTES }), (request, response) => {
  const signature = request.header('x-gateway-signature')
  if (!signature) throw new HttpError(400, 'Gateway signature is required')
  const expected = createHmac('sha256', env.PAYMENT_WEBHOOK_SECRET).update(request.body).digest('hex')
  const supplied = Buffer.from(signature, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  if (supplied.length !== expectedBuffer.length || !timingSafeEqual(supplied, expectedBuffer)) throw new HttpError(401, 'Invalid gateway signature')
  // Provider-specific adapters should verify amount, currency, and quote version next.
  response.status(202).json({ accepted: true, gateway: request.params.gateway, bytes: Buffer.byteLength(request.body) })
})
