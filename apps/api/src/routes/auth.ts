import { Router } from 'express'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { recordAudit } from '../lib/audit.js'
import { createRefreshSession, revokeRefreshToken, rotateRefreshToken, userResponse } from '../lib/auth-sessions.js'
import { verifyPassword } from '../lib/passwords.js'
import { authenticate, signAccessToken } from '../middleware/auth.js'
import { HttpError } from '../middleware/errors.js'
import { loginRateLimiter, refreshRateLimiter } from '../middleware/security.js'

const loginSchema = z.object({
  email: z.string().trim().email().max(320).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
}).strict()

function refreshCookie(request: { header(name: string): string | undefined }) {
  const header = request.header('cookie')
  if (!header) return undefined
  const expected = `${env.AUTH_REFRESH_COOKIE_NAME}=`
  const value = header.split(';').map((part) => part.trim()).find((part) => part.startsWith(expected))?.slice(expected.length)
  if (!value) return undefined
  try {
    return decodeURIComponent(value)
  } catch {
    return undefined
  }
}

function setRefreshCookie(response: { setHeader(name: string, value: string): void }, token: string, maxAge: number) {
  const secure = env.AUTH_COOKIE_SECURE ? '; Secure' : ''
  response.setHeader('Set-Cookie', `${env.AUTH_REFRESH_COOKIE_NAME}=${encodeURIComponent(token)}; Max-Age=${maxAge}; Path=/api/v1/auth; HttpOnly; SameSite=Lax${secure}`)
}

function clearRefreshCookie(response: { setHeader(name: string, value: string): void }) {
  const secure = env.AUTH_COOKIE_SECURE ? '; Secure' : ''
  response.setHeader('Set-Cookie', `${env.AUTH_REFRESH_COOKIE_NAME}=; Max-Age=0; Path=/api/v1/auth; HttpOnly; SameSite=Lax${secure}`)
}

function requestContext(request: { ip?: string; header(name: string): string | undefined }) {
  return {
    ipAddress: (request.ip ?? 'unknown').slice(0, 128),
    userAgent: request.header('user-agent')?.slice(0, 512),
  }
}

const invalidCredentials = () => new HttpError(401, 'Invalid email or password')

export const authRouter = Router()

authRouter.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store')
  next()
})

authRouter.post('/login', loginRateLimiter, async (request, response) => {
  const input = loginSchema.parse(request.body)
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, name: true, roles: true, organizationId: true, isActive: true, passwordHash: true, failedLoginCount: true, lockedUntil: true },
  })
  if (!user || !user.isActive || (user.lockedUntil && user.lockedUntil > new Date())) throw invalidCredentials()

  if (!await verifyPassword(input.password, user.passwordHash)) {
    const nextFailedCount = user.failedLoginCount + 1
    const lockedUntil = nextFailedCount >= env.AUTH_MAX_LOGIN_ATTEMPTS ? new Date(Date.now() + env.AUTH_LOCKOUT_SECONDS * 1000) : null
    await prisma.user.update({ where: { id: user.id }, data: { failedLoginCount: { increment: 1 }, ...(lockedUntil ? { lockedUntil } : {}) } })
    logger.warn({ event: 'security.login_failed', userId: user.id, organizationId: user.organizationId, requestId: String(request.id) }, 'login failed')
    throw invalidCredentials()
  }

  const context = requestContext(request)
  const session = await prisma.$transaction(async (transaction) => {
    await transaction.user.update({ where: { id: user.id }, data: { failedLoginCount: 0, lockedUntil: null } })
    const created = await createRefreshSession(transaction, { userId: user.id, ...context })
    await recordAudit(transaction, {
      organizationId: user.organizationId,
      actorId: user.id,
      action: 'auth.login',
      entityType: 'User',
      entityId: user.id,
      requestId: String(request.id),
      payload: { userAgent: context.userAgent ?? null },
    })
    return created
  })
  setRefreshCookie(response, session.token, env.REFRESH_TOKEN_TTL_SECONDS)
  response.json({
    data: {
      accessToken: signAccessToken({ userId: user.id, organizationId: user.organizationId, roles: user.roles, sessionId: session.session.id }),
      tokenType: 'Bearer',
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      user: userResponse(user),
    },
  })
})

authRouter.post('/refresh', refreshRateLimiter, async (request, response) => {
  const token = refreshCookie(request)
  if (!token) throw new HttpError(401, 'Refresh token cookie is required')
  const rotated = await rotateRefreshToken(token, { requestId: String(request.id), ...requestContext(request) })
  setRefreshCookie(response, rotated.token, env.REFRESH_TOKEN_TTL_SECONDS)
  response.json({
    data: {
      accessToken: signAccessToken({ userId: rotated.user.id, organizationId: rotated.user.organizationId, roles: rotated.user.roles, sessionId: rotated.session.id }),
      tokenType: 'Bearer',
      expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
      user: userResponse(rotated.user),
    },
  })
})

authRouter.post('/logout', async (request, response) => {
  const token = refreshCookie(request)
  if (token) await revokeRefreshToken(token, { requestId: String(request.id) })
  clearRefreshCookie(response)
  response.status(204).send()
})

authRouter.get('/me', authenticate, async (request, response) => {
  const user = await prisma.user.findUnique({
    where: { id: request.auth!.userId },
    select: { id: true, email: true, name: true, roles: true, organizationId: true, isActive: true },
  })
  if (!user?.isActive) throw new HttpError(401, 'User is no longer active')
  response.json({ data: userResponse(user) })
})
