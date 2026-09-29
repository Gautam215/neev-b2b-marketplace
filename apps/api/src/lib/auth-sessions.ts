import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import type { Prisma, Role } from '@prisma/client'
import { env } from '../config/env.js'
import { prisma } from './prisma.js'
import { recordAudit } from './audit.js'
import { HttpError } from '../middleware/errors.js'

export type SessionUser = {
  id: string
  email: string
  name: string
  roles: Role[]
  organizationId: string
  isActive: boolean
}

type SessionWriter = Pick<Prisma.TransactionClient, 'refreshSession'>

export function hashRefreshToken(token: string) {
  return createHmac('sha256', env.JWT_SECRET).update(token).digest('hex')
}

export function createRawRefreshToken() {
  return randomBytes(48).toString('base64url')
}

export function refreshExpiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000)
}

export function userResponse(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    roles: user.roles,
    organizationId: user.organizationId,
  }
}

export async function createRefreshSession(
  writer: SessionWriter,
  input: { userId: string; familyId?: string; userAgent?: string; ipAddress?: string },
) {
  const token = createRawRefreshToken()
  const session = await writer.refreshSession.create({
    data: {
      id: randomUUID(),
      userId: input.userId,
      familyId: input.familyId ?? randomUUID(),
      tokenHash: hashRefreshToken(token),
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      expiresAt: refreshExpiry(),
    },
  })
  return { session, token }
}

export async function rotateRefreshToken(rawToken: string, input: { requestId: string; userAgent?: string; ipAddress?: string }) {
  const tokenHash = hashRefreshToken(rawToken)
  const current = await prisma.refreshSession.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, email: true, name: true, roles: true, organizationId: true, isActive: true } } },
  })
  if (!current || !current.user.isActive) throw new HttpError(401, 'Invalid refresh token')

  const now = new Date()
  if (current.usedAt || current.revokedAt) {
    await prisma.refreshSession.updateMany({ where: { familyId: current.familyId, revokedAt: null }, data: { revokedAt: now } })
    throw new HttpError(401, 'Refresh token reuse detected')
  }
  if (current.expiresAt <= now) {
    await prisma.refreshSession.update({ where: { id: current.id }, data: { revokedAt: now } })
    throw new HttpError(401, 'Refresh token has expired')
  }

  return prisma.$transaction(async (transaction) => {
    const nextId = randomUUID()
    const update = await transaction.refreshSession.updateMany({
      where: { id: current.id, tokenHash, usedAt: null, revokedAt: null },
      data: { usedAt: now, revokedAt: now, replacedById: nextId },
    })
    if (update.count !== 1) throw new HttpError(401, 'Refresh token was already used')
    const next = await createRefreshSession(transaction, {
      userId: current.userId,
      familyId: current.familyId,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
    })
    await recordAudit(transaction, {
      organizationId: current.user.organizationId,
      actorId: current.userId,
      action: 'auth.refresh',
      entityType: 'RefreshSession',
      entityId: next.session.id,
      requestId: input.requestId,
      payload: { familyId: current.familyId },
    })
    return { session: next.session, token: next.token, user: current.user }
  })
}

export async function revokeRefreshToken(rawToken: string, input: { requestId: string }) {
  const current = await prisma.refreshSession.findUnique({
    where: { tokenHash: hashRefreshToken(rawToken) },
    include: { user: { select: { organizationId: true } } },
  })
  if (!current) return
  await prisma.$transaction(async (transaction) => {
    await transaction.refreshSession.updateMany({ where: { familyId: current.familyId, revokedAt: null }, data: { revokedAt: new Date() } })
    await recordAudit(transaction, {
      organizationId: current.user.organizationId,
      actorId: current.userId,
      action: 'auth.logout',
      entityType: 'RefreshSession',
      entityId: current.id,
      requestId: input.requestId,
      payload: { familyId: current.familyId },
    })
  })
}
