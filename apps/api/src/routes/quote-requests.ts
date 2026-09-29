import { Router } from 'express'
import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { authenticate, requirePermissions } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { quoteRequestSchema } from '../schemas/marketplace.js'
import { HttpError } from '../middleware/errors.js'

export const quoteRequestRouter = Router()

quoteRequestRouter.post('/', authenticate, requirePermissions('quote_requests:create'), async (request, response) => {
  const idempotencyKey = request.header('idempotency-key')?.trim()
  if (!idempotencyKey) throw new HttpError(400, 'Idempotency-Key header is required')
  if (idempotencyKey.length > 128) throw new HttpError(400, 'Idempotency-Key must be 128 characters or fewer')
  const input = quoteRequestSchema.parse(request.body)
  const idempotencyHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  const identity = { buyerOrgId: request.auth!.organizationId, idempotencyKey }
  const existing = await prisma.quoteRequest.findUnique({ where: { buyerOrgId_idempotencyKey: identity } })
  if (existing) {
    if (existing.idempotencyHash !== idempotencyHash) throw new HttpError(409, 'Idempotency-Key was already used with different data')
    response.status(200).json({ data: existing, idempotent: true })
    return
  }

  let quoteRequest: Awaited<ReturnType<typeof prisma.quoteRequest.create>>
  try {
    quoteRequest = await prisma.quoteRequest.create({
      data: {
        ...input,
        idempotencyKey,
        idempotencyHash,
        buyerId: request.auth!.userId,
        buyerOrgId: request.auth!.organizationId,
      },
    })
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    const concurrent = await prisma.quoteRequest.findUniqueOrThrow({ where: { buyerOrgId_idempotencyKey: identity } })
    if (concurrent.idempotencyHash !== idempotencyHash) throw new HttpError(409, 'Idempotency-Key was already used with different data')
    response.status(200).json({ data: concurrent, idempotent: true })
    return
  }
  response.status(201).json({ data: quoteRequest, idempotent: false })
})
