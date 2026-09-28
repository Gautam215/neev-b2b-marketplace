import type { ErrorRequestHandler, RequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { logger } from '../lib/logger.js'

export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly details?: unknown) {
    super(message)
    this.name = 'HttpError'
  }
}

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new HttpError(404, 'Route not found'))
}

export const errorHandler: ErrorRequestHandler = (error, request, response, _next) => {
  let status = error instanceof HttpError ? error.status : 500
  let message = error instanceof Error ? error.message : 'Internal server error'
  let details: unknown

  if (error instanceof ZodError) {
    status = 400
    message = 'Validation failed'
    details = error.flatten()
  } else if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      status = 409
      message = 'Resource already exists'
    } else if (error.code === 'P2025') {
      status = 404
      message = 'Resource not found'
    }
  } else if (error instanceof SyntaxError && 'body' in error) {
    status = 400
    message = 'Malformed request body'
  } else if ((error as { type?: string })?.type === 'entity.too.large') {
    status = 413
    message = 'Request body is too large'
  }

  const requestId = String(request.id)
  if ([400, 401, 403, 413, 429].includes(status)) logger.warn({ event: 'security.request_rejected', status, requestId, method: request.method, url: request.originalUrl }, message)
  if (status >= 500) logger.error({ err: error, requestId }, 'unhandled request error')
  response.status(status).json({
    error: status >= 500 ? 'Internal server error' : message,
    requestId,
    ...(error instanceof HttpError && error.details ? { details: error.details } : {}),
    ...(details ? { details } : {}),
  })
}
