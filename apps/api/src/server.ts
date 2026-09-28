import { createServer } from 'node:http'
import { createApp } from './app.js'
import { env } from './config/env.js'
import { closeRedis, connectRedis } from './lib/redis.js'
import { prisma } from './lib/prisma.js'
import { logger } from './lib/logger.js'
import { attachRealtime } from './lib/realtime.js'
import { closeMongo, connectMongo } from './lib/mongo.js'

const app = createApp()
const server = createServer(app)
attachRealtime(server)

async function start() {
  await prisma.$connect()
  await connectRedis()
  await connectMongo()
  server.listen(env.PORT, () => logger.info({ port: env.PORT }, 'neev api listening'))
}

async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down')
  server.close(async () => {
    await Promise.allSettled([prisma.$disconnect(), closeRedis(), closeMongo()])
    process.exit(0)
  })
}

process.once('SIGTERM', () => void shutdown('SIGTERM'))
process.once('SIGINT', () => void shutdown('SIGINT'))
start().catch((error) => {
  logger.fatal({ err: error }, 'api failed to start')
  process.exit(1)
})
