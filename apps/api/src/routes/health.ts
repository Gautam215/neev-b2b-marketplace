import { Router } from 'express'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { isMongoConfigured, pingMongo } from '../lib/mongo.js'
import { withTimeout } from '../lib/timeouts.js'

export const healthRouter = Router()

healthRouter.get('/live', (_request, response) => {
  response.json({ status: 'ok', service: 'neev-api' })
})

healthRouter.get('/ready', async (_request, response) => {
  const checks = await Promise.allSettled([
    withTimeout(prisma.$queryRaw`SELECT 1`, env.HEALTH_CHECK_TIMEOUT_MS, 'postgres health check timed out'),
    redis.isOpen ? withTimeout(redis.ping(), env.HEALTH_CHECK_TIMEOUT_MS, 'redis health check timed out') : Promise.reject(new Error('redis is not connected')),
    isMongoConfigured() ? withTimeout(pingMongo(), env.HEALTH_CHECK_TIMEOUT_MS, 'mongo health check timed out') : Promise.resolve(),
  ])
  const ready = checks.every((check) => check.status === 'fulfilled')
  response.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: {
      postgres: checks[0]?.status === 'fulfilled',
      redis: checks[1]?.status === 'fulfilled',
      mongo: isMongoConfigured() ? checks[2]?.status === 'fulfilled' : 'not_configured',
    },
  })
})
