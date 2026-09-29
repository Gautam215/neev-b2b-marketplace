import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { closeRedis, connectRedis } from './lib/redis.js'
import { prisma } from './lib/prisma.js'
import { logger } from './lib/logger.js'
import { attachRealtime } from './lib/realtime.js'
import { closeMongo, connectMongo } from './lib/mongo.js'
import { withTimeout } from './lib/timeouts.js'
import { closeQueues, startQueueWorkers } from './lib/queues.js'

const app = createApp()
const server = createServer(app)
attachRealtime(server)

let shuttingDown = false

async function start() {
  await withTimeout(prisma.$connect(), env.STARTUP_TIMEOUT_MS, 'postgres startup timed out')
  await withTimeout(connectRedis(), env.STARTUP_TIMEOUT_MS, 'redis startup timed out')
  await withTimeout(connectMongo(), env.STARTUP_TIMEOUT_MS, 'mongo startup timed out')
  if (env.RUN_WORKERS) await startQueueWorkers()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(env.PORT, () => resolve())
  })
  logger.info({ port: env.PORT }, 'neev api listening')
}

async function shutdown(signal: string, exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true
  logger.info({ signal }, 'shutting down')
  const closeServer = server.listening
    ? new Promise<void>((resolve) => server.close(() => resolve()))
    : Promise.resolve()
  await Promise.allSettled([
    withTimeout(closeServer, env.SHUTDOWN_TIMEOUT_MS, 'http server shutdown timed out'),
    // Stop workers before closing their database and Redis dependencies.
    withTimeout(closeQueues(), env.SHUTDOWN_TIMEOUT_MS, 'background queues shutdown timed out'),
  ])
  await Promise.allSettled([
    withTimeout(prisma.$disconnect(), env.SHUTDOWN_TIMEOUT_MS, 'postgres shutdown timed out'),
    withTimeout(closeRedis(), env.SHUTDOWN_TIMEOUT_MS, 'redis shutdown timed out'),
    withTimeout(closeMongo(), env.SHUTDOWN_TIMEOUT_MS, 'mongo shutdown timed out'),
  ])
  process.exit(exitCode)
}

process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))
process.once('uncaughtException', (error) => {
  logger.fatal({ err: error }, 'uncaught exception')
  void shutdown('uncaughtException', 1)
})
process.once('unhandledRejection', (error) => {
  logger.fatal({ err: error }, 'unhandled rejection')
  void shutdown('unhandledRejection', 1)
})

start().catch((error) => {
  logger.fatal({ err: error }, 'api failed to start')
  void shutdown('startup failure', 1)
})
