import { PrismaClient } from '@prisma/client'
import { env } from '../config/env.js'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
const databaseUrl = new URL(env.DATABASE_URL)
databaseUrl.searchParams.set('connection_limit', String(env.DATABASE_POOL_SIZE))
databaseUrl.searchParams.set('pool_timeout', String(env.DATABASE_POOL_TIMEOUT_SECONDS))

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasources: { db: { url: databaseUrl.toString() } },
  log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
})

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
