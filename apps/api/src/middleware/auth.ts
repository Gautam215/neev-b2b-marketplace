import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { Role } from '@prisma/client'
import { randomUUID } from 'node:crypto'
import jwt, { type SignOptions } from 'jsonwebtoken'
import { z } from 'zod'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { logger } from '../lib/logger.js'
import { hasAnyPermission, type Permission } from '../lib/authorization.js'
import { HttpError } from './errors.js'

export const roleValues = ['buyer', 'buyer_finance', 'supplier', 'supplier_ops', 'ops_admin'] as const
const roleSchema = z.enum(roleValues)

export type AccessTokenClaims = {
  sub: string
  organizationId: string
  roles: Role[]
  tokenType: 'access'
  iat: number
  exp: number
}

export type AuthUserRecord = {
  id: string
  organizationId: string
  roles: Role[]
  isActive: boolean
}

const accessTokenClaimsSchema = z.object({
  sub: z.string().trim().min(1),
  organizationId: z.string().trim().min(1),
  roles: z.array(roleSchema).min(1).superRefine((roles, context) => {
    if (new Set(roles).size !== roles.length) context.addIssue({ code: 'custom', message: 'roles must be unique' })
  }),
  tokenType: z.literal('access'),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
}).passthrough()

function roleSetsMatch(left: Role[], right: Role[]) {
  return left.length === right.length && left.every((role) => right.includes(role))
}

export function userMatchesAccessToken(claims: AccessTokenClaims, user: AuthUserRecord) {
  return user.id === claims.sub
    && user.isActive
    && user.organizationId === claims.organizationId
    && roleSetsMatch(claims.roles, user.roles)
}

export function signAccessToken(input: { userId: string; organizationId: string; roles: Role[]; expiresIn?: SignOptions['expiresIn'] }) {
  return jwt.sign(
    { sub: input.userId, organizationId: input.organizationId, roles: input.roles, tokenType: 'access' },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      expiresIn: input.expiresIn ?? '15m',
      jwtid: randomUUID(),
    },
  )
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ['HS256'],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
      clockTolerance: env.JWT_CLOCK_TOLERANCE_SECONDS,
    })
    const parsed = accessTokenClaimsSchema.safeParse(payload)
    if (!parsed.success) throw new Error('access token claims are incomplete')
    return parsed.data as AccessTokenClaims
  } catch {
    throw new HttpError(401, 'Invalid access token')
  }
}

async function readAuth(request: Request) {
  const header = request.header('authorization')
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Bearer token required')

  const token = header.slice('Bearer '.length)
  const claims = verifyAccessToken(token)

  if (env.AUTH_REQUIRE_USER_LOOKUP) {
    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, organizationId: true, roles: true, isActive: true },
    })
    if (!user || !userMatchesAccessToken(claims, user)) {
      throw new HttpError(401, 'Access token is no longer valid')
    }
  }

  return { userId: claims.sub, organizationId: claims.organizationId, roles: claims.roles }
}

export const authenticate: RequestHandler = (request, _response, next) => {
  void readAuth(request).then((auth) => {
    request.auth = auth
    next()
  }).catch((error) => {
    if (error instanceof HttpError) {
      next(error)
      return
    }
    logger.error({ err: error, event: 'security.auth_lookup_failed' }, 'authentication lookup failed')
    next(new HttpError(503, 'Authentication service unavailable'))
  })
}

export const optionalAuth: RequestHandler = (request, _response, next) => {
  if (!request.header('authorization')) {
    next()
    return
  }
  authenticate(request, _response, next)
}

export function requireRoles(...allowedRoles: Role[]): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.auth) {
      next(new HttpError(401, 'Authentication required'))
      return
    }
    if (!request.auth.roles.some((role) => allowedRoles.includes(role))) {
      next(new HttpError(403, 'Insufficient role permissions'))
      return
    }
    next()
  }
}

export function requirePermissions(...permissions: Permission[]): RequestHandler {
  return (request: Request, _response: Response, next: NextFunction) => {
    if (!request.auth) {
      next(new HttpError(401, 'Authentication required'))
      return
    }
    if (!hasAnyPermission(request.auth.roles, permissions)) {
      next(new HttpError(403, 'Insufficient role permissions'))
      return
    }
    next()
  }
}
