import type { RequestHandler } from 'express'
import { env } from '../config/env.js'
import { HttpError } from './errors.js'

function limitFor(request: Parameters<RequestHandler>[0]) {
  if (/^\/api\/v1\/payments\/[^/]+\/webhook$/.test(request.path)) return env.MAX_WEBHOOK_BODY_BYTES
  const contentType = request.header('content-type')?.split(';', 1)[0]?.trim().toLowerCase()
  if (contentType === 'application/x-www-form-urlencoded') return env.MAX_URLENCODED_BODY_BYTES
  if (contentType === 'multipart/form-data') return env.MAX_MULTIPART_BODY_BYTES
  return env.MAX_JSON_BODY_BYTES
}

export const requestSizeLimit: RequestHandler = (request, _response, next) => {
  const contentLength = request.header('content-length')
  if (!contentLength) {
    next()
    return
  }
  if (!/^\d+$/.test(contentLength)) {
    next(new HttpError(400, 'Invalid Content-Length header'))
    return
  }
  const bytes = Number(contentLength)
  if (!Number.isSafeInteger(bytes) || bytes > limitFor(request)) {
    next(new HttpError(413, 'Request body is too large'))
    return
  }
  next()
}
