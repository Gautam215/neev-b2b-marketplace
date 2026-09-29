import { env } from './config/env.js'
import { closeQueues, startQueueWorkers } from './lib/queues.js'
import { closeRedis, connectRedis } from './lib/redis.js'
import { prisma } from './lib/prisma.js'
import { logger } from './lib/logger.js'
import { withTimeout } from './lib/timeouts.js'

let stopping = false

async function shutdown(signal: string, exitCode = 0) {
  if (stopping) return
  stopping = true
  logger.info({ signal }, 'background worker shutting down')
  await Promise.allSettled([
    withTimeout(closeQueues(), env.SHUTDOWN_TIMEOUT_MS, 'background queues shutdown timed out'),
  ])
  await Promise.allSettled([
    withTimeout(prisma.$disconnect(), env.SHUTDOWN_TIMEOUT_MS, 'postgres shutdown timed out'),
    withTimeout(closeRedis(), env.SHUTDOWN_TIMEOUT_MS, 'redis shutdown timed out'),
  ])
  process.exit(exitCode)
}

process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'background worker uncaught exception')
  void shutdown('uncaughtException', 1)
})
process.once('unhandledRejection', (error) => {
  logger.fatal({ err: error }, 'background worker unhandled rejection')
  void shutdown('unhandledRejection', 1)
})

async function start() {
  await prisma.$connect()
  await connectRedis()
  await startQueueWorkers()
  logger.info({ intervalSeconds: env.RECONCILIATION_SWEEP_INTERVAL_SECONDS }, 'background worker ready')
}

start().catch((error) => {
  logger.fatal({ err: error }, 'background worker failed to start')
  void shutdown('startup failure', 1)
})
