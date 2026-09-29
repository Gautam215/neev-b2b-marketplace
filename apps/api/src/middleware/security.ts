import cors from 'cors'
import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import helmet from 'helmet'
import { env } from '../config/env.js'
import { logger } from '../lib/logger.js'
import { redis } from '../lib/redis.js'

function store(prefix: string) {
  if (env.RATE_LIMIT_STORE !== 'redis') return undefined
  return new RedisStore({
    prefix,
    sendCommand: (...args: string[]) => redis.sendCommand(args),
  })
}

function rejected(request: Parameters<NonNullable<Options['handler']>>[0], response: Parameters<NonNullable<Options['handler']>>[1]) {
  logger.warn({ event: 'security.rate_limited', requestId: String(request.id), method: request.method, url: request.originalUrl }, 'request rate limited')
  response.status(429).json({ error: 'Too many requests', requestId: String(request.id) })
}

function createLimiter(options: Partial<Options> & { prefix: string }) {
  const { prefix, ...rest } = options
  return rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_SECONDS * 1000,
    limit: env.RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    ...rest,
    store: store(prefix),
    handler: rejected,
  })
}

export const rateLimiter = createLimiter({ prefix: 'neev:ratelimit:global:' })

export const writeRateLimiter = createLimiter({
  prefix: 'neev:ratelimit:write:',
  windowMs: 60_000,
  limit: 60,
})

export const loginRateLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_SECONDS * 1000,
  limit: env.LOGIN_RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (request) => `${ipKeyGenerator(request.ip ?? 'unknown')}:${String(request.body?.email ?? '').trim().toLowerCase()}`,
  store: store('neev:ratelimit:login:'),
  handler: rejected,
})

export const refreshRateLimiter = rateLimit({
  windowMs: env.LOGIN_RATE_LIMIT_WINDOW_SECONDS * 1000,
  limit: env.LOGIN_RATE_LIMIT_MAX_REQUESTS * 2,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (request) => ipKeyGenerator(request.ip ?? 'unknown'),
  store: store('neev:ratelimit:refresh:'),
  handler: rejected,
})

export const securityMiddleware = [
  helmet(),
  cors({ origin: env.WEB_ORIGIN, credentials: true }),
  rateLimiter,
]
