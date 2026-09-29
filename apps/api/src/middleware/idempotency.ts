import { createHash } from 'node:crypto'
import type { RequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { HttpError } from './errors.js'

function canonicalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, nested]) => [key, canonicalize(nested)]))
  }
  return value
}

export function hashIdempotencyValue(value: unknown) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')
}

function jsonValue(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

async function finishRecord(id: string, status: number, body: Prisma.InputJsonValue) {
  try {
    if (status >= 500) {
      await prisma.idempotencyRecord.deleteMany({ where: { id, status: 'PENDING' } })
      return
    }
    await prisma.idempotencyRecord.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'COMPLETED', responseStatus: status, responseBody: body },
    })
  } catch (error) {
    logger.error({ err: error, id }, 'idempotency record finalization failed')
  }
}

export const requireIdempotency: RequestHandler = (request, response, next) => {
  void (async () => {
    if (!request.auth) throw new HttpError(401, 'Authentication required')
    const key = request.header('idempotency-key')?.trim()
    if (!key) throw new HttpError(400, 'Idempotency-Key header is required')
    if (key.length > 128) throw new HttpError(400, 'Idempotency-Key must be 128 characters or fewer')

    const route = `${request.baseUrl}${request.path}`
    const requestHash = hashIdempotencyValue({ method: request.method, route, body: request.body })
    const identity = { organizationId: request.auth.organizationId, userId: request.auth.userId, method: request.method, route, key }
    let record = await prisma.idempotencyRecord.findUnique({ where: { organizationId_userId_method_route_key: identity } })
    if (record && record.expiresAt <= new Date()) {
      await prisma.idempotencyRecord.delete({ where: { id: record.id } })
      record = null
    }
    if (record) {
      if (record.requestHash !== requestHash) throw new HttpError(409, 'Idempotency-Key was already used with different data')
      if (record.status === 'COMPLETED' && record.responseBody !== null && record.responseStatus !== null) {
        response.setHeader('Idempotent-Replayed', 'true')
        response.status(record.responseStatus).json(record.responseBody)
        return
      }
      throw new HttpError(409, 'An identical request is already in progress')
    }

    try {
      record = await prisma.idempotencyRecord.create({
        data: {
          ...identity,
          userId: request.auth.userId,
          requestHash,
          expiresAt: new Date(Date.now() + env.IDEMPOTENCY_TTL_SECONDS * 1000),
        },
      })
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
      const concurrent = await prisma.idempotencyRecord.findUnique({ where: { organizationId_userId_method_route_key: identity } })
      if (!concurrent || concurrent.requestHash !== requestHash) throw new HttpError(409, 'Idempotency-Key was already used with different data')
      if (concurrent.status === 'COMPLETED' && concurrent.responseBody !== null && concurrent.responseStatus !== null) {
        response.setHeader('Idempotent-Replayed', 'true')
        response.status(concurrent.responseStatus).json(concurrent.responseBody)
        return
      }
      throw new HttpError(409, 'An identical request is already in progress')
    }

    let body: Prisma.InputJsonValue = {}
    const originalJson = response.json.bind(response)
    response.json = ((payload: unknown) => {
      body = jsonValue(payload)
      return originalJson(payload)
    }) as typeof response.json
    response.once('finish', () => { void finishRecord(record!.id, response.statusCode, body) })
    next()
  })().catch(next)
}
