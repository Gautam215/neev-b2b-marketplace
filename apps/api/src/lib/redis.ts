import { createClient } from 'redis'
import { env } from '../config/env.js'
import { logger } from './logger.js'

export const redis = createClient({ url: env.REDIS_URL })
redis.on('error', (error) => logger.error({ err: error }, 'redis client error'))

export async function connectRedis() {
  if (!redis.isOpen) await redis.connect()
}

export async function closeRedis() {
  if (redis.isOpen) await redis.quit()
}
