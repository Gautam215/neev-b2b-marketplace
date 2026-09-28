import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { quoteRequestSchema } from '../schemas/marketplace.js'
import { HttpError } from '../middleware/errors.js'

export const quoteRequestRouter = Router()

quoteRequestRouter.post('/', authenticate, requireRoles('buyer', 'buyer_finance'), async (request, response) => {
  const idempotencyKey = request.header('idempotency-key')
  if (!idempotencyKey) throw new HttpError(400, 'Idempotency-Key header is required')
  const input = quoteRequestSchema.parse(request.body)
  const existing = await prisma.quoteRequest.findUnique({ where: { idempotencyKey } })
  if (existing) {
    response.status(200).json({ data: existing, idempotent: true })
    return
  }

  let quoteRequest: Awaited<ReturnType<typeof prisma.quoteRequest.create>>
  try {
    quoteRequest = await prisma.quoteRequest.create({
      data: {
        ...input,
        idempotencyKey,
        buyerId: request.auth!.userId,
        buyerOrgId: request.auth!.organizationId,
      },
    })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    const concurrent = await prisma.quoteRequest.findUniqueOrThrow({ where: { idempotencyKey } })
    response.status(200).json({ data: concurrent, idempotent: true })
    return
  }
  response.status(201).json({ data: quoteRequest, idempotent: false })
})
