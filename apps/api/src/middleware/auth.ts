import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { Role } from '@prisma/client'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { env } from '../config/env.js'
import { HttpError } from './errors.js'

const roleValues: Role[] = ['buyer', 'buyer_finance', 'supplier', 'supplier_ops', 'ops_admin']

function isRole(value: unknown): value is Role {
  return typeof value === 'string' && roleValues.includes(value as Role)
}

function readAuth(request: Request) {
  const header = request.header('authorization')
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Bearer token required')

  const token = header.slice('Bearer '.length)
  const payload = jwt.verify(token, env.JWT_SECRET)
  if (typeof payload === 'string') throw new HttpError(401, 'Invalid access token')

  const claims = payload as JwtPayload & { roles?: unknown; organizationId?: unknown }
  const roles = Array.isArray(claims.roles) ? claims.roles.filter(isRole) : []
  if (typeof claims.sub !== 'string' || typeof claims.organizationId !== 'string' || roles.length === 0) {
    throw new HttpError(401, 'Access token claims are incomplete')
  }
  return { userId: claims.sub, organizationId: claims.organizationId, roles }
}

export const authenticate: RequestHandler = (request, _response, next) => {
  try {
    request.auth = readAuth(request)
    next()
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, 'Invalid access token'))
  }
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
