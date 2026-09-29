import express from 'express'
import { pinoHttp } from 'pino-http'
import swaggerUi from 'swagger-ui-express'
import { env } from './config/env.js'
import { logger } from './lib/logger.js'
import { requestId } from './lib/request-id.js'
import { securityMiddleware } from './middleware/security.js'
import { errorHandler, notFound } from './middleware/errors.js'
import { requestSizeLimit } from './middleware/request-limits.js'
import { healthRouter } from './routes/health.js'
import { searchRouter } from './routes/search.js'
import { quoteRequestRouter } from './routes/quote-requests.js'
import { inventoryRouter } from './routes/inventory.js'
import { dispatchRouter } from './routes/dispatches.js'
import { timelineRouter } from './routes/timeline.js'
import { paymentRouter } from './routes/payments.js'
import { quoteRouter } from './routes/quotes.js'
import { paymentIntentRouter } from './routes/payment-intents.js'
import { pricingRouter } from './routes/pricing.js'
import { sustainabilityRouter } from './routes/sustainability.js'
import { openapiDocument } from './docs/openapi.js'
import { authRouter } from './routes/auth.js'
import { authenticate } from './middleware/auth.js'
import { writeRateLimiter } from './middleware/security.js'

export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', env.TRUST_PROXY)
  app.use(requestId)
  app.use(pinoHttp({ logger }))
  app.use(securityMiddleware)
  app.use(requestSizeLimit)
  app.use(express.raw({ type: 'multipart/form-data', limit: env.MAX_MULTIPART_BODY_BYTES }))

  app.use('/api/v1/health', healthRouter)
  app.get('/api/v1/docs/openapi.json', (_request, response) => response.json(openapiDocument))
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument, { explorer: true }))
  // Webhook routes need the raw body for provider signature verification.
  app.use('/api/v1/payments', paymentRouter)
  app.use(express.json({ limit: env.MAX_JSON_BODY_BYTES, strict: true }))
  app.use(express.urlencoded({ extended: false, limit: env.MAX_URLENCODED_BODY_BYTES }))
  app.use('/api/v1/auth', authRouter)
  app.use([
    '/api/v1/quote-requests',
    '/api/v1/quotes',
    '/api/v1/payment-intents',
    '/api/v1/pricing',
    '/api/v1/sustainability',
    '/api/v1/inventory',
    '/api/v1/dispatches',
  ], writeRateLimiter)
  app.use('/api/v1/search', searchRouter)
  app.use('/api/v1/quote-requests', quoteRequestRouter)
  app.use('/api/v1/quotes', quoteRouter)
  app.use('/api/v1/payment-intents', paymentIntentRouter)
  app.use('/api/v1/pricing', pricingRouter)
  app.use('/api/v1/sustainability', sustainabilityRouter)
  app.use('/api/v1/inventory', inventoryRouter)
  app.use('/api/v1/dispatches', dispatchRouter)
  app.use('/api/v1/orders', timelineRouter)
  app.get('/api/v1/meta', authenticate, (_request, response) => response.json({ service: 'neev-api', version: 'v1', environment: env.NODE_ENV }))
  app.use(notFound)
  app.use(errorHandler)
  return app
}
