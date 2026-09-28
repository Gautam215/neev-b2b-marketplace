import cors from 'cors'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { env } from '../config/env.js'
import { logger } from '../lib/logger.js'

const rateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (request, response) => {
    logger.warn({ event: 'security.rate_limited', requestId: String(request.id), method: request.method, url: request.originalUrl }, 'request rate limited')
    response.status(429).json({ error: 'Too many requests', requestId: String(request.id) })
  },
})

export const securityMiddleware = [
  helmet(),
  cors({ origin: env.WEB_ORIGIN, credentials: true }),
  rateLimiter,
]
