import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { redis } from '../lib/redis.js'
import { isMongoConfigured, pingMongo } from '../lib/mongo.js'

export const healthRouter = Router()

healthRouter.get('/live', (_request, response) => {
  response.json({ status: 'ok', service: 'neev-api' })
})

healthRouter.get('/ready', async (_request, response) => {
  const checks = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    redis.isOpen ? redis.ping() : Promise.reject(new Error('redis is not connected')),
    isMongoConfigured() ? pingMongo() : Promise.resolve(),
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
