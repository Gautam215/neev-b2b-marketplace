import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), 'DATABASE_URL must be a PostgreSQL URL'),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_POOL_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(120).default(10),
  REDIS_URL: z.string().url(),
  MONGODB_URL: z.string().url().optional(),
  MONGODB_DATABASE: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).default('neev'),
  MONGODB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(5_000),
  MONGODB_ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).optional(),
  JWT_SECRET: z.string().min(32),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16),
  WEB_ORIGIN: z.string().url(),
  MAX_JSON_BODY_BYTES: z.coerce.number().int().min(1024).max(1024 * 1024).default(64 * 1024),
  MAX_URLENCODED_BODY_BYTES: z.coerce.number().int().min(1024).max(256 * 1024).default(32 * 1024),
  MAX_MULTIPART_BODY_BYTES: z.coerce.number().int().min(1024).max(10 * 1024 * 1024).default(5 * 1024 * 1024),
  MAX_WEBHOOK_BODY_BYTES: z.coerce.number().int().min(1024).max(1024 * 1024).default(256 * 1024),
  MAX_WS_MESSAGE_BYTES: z.coerce.number().int().min(1024).max(1024 * 1024).default(64 * 1024),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
}).superRefine((value, context) => {
  if (Boolean(value.MONGODB_URL) !== Boolean(value.MONGODB_ENCRYPTION_KEY)) {
    context.addIssue({ code: 'custom', path: ['MONGODB_ENCRYPTION_KEY'], message: 'MONGODB_ENCRYPTION_KEY is required when MONGODB_URL is configured' })
  }
  if (value.MONGODB_ENCRYPTION_KEY) {
    const decoded = Buffer.from(value.MONGODB_ENCRYPTION_KEY, 'base64')
    if (decoded.length !== 32) context.addIssue({ code: 'custom', path: ['MONGODB_ENCRYPTION_KEY'], message: 'MONGODB_ENCRYPTION_KEY must decode to exactly 32 bytes' })
  }
})

export const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  PORT: process.env.PORT,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_POOL_SIZE: process.env.DATABASE_POOL_SIZE,
  DATABASE_POOL_TIMEOUT_SECONDS: process.env.DATABASE_POOL_TIMEOUT_SECONDS,
  REDIS_URL: process.env.REDIS_URL,
  MONGODB_URL: process.env.MONGODB_URL,
  MONGODB_DATABASE: process.env.MONGODB_DATABASE,
  MONGODB_POOL_SIZE: process.env.MONGODB_POOL_SIZE,
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  MONGODB_ENCRYPTION_KEY: process.env.MONGODB_ENCRYPTION_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET,
  WEB_ORIGIN: process.env.WEB_ORIGIN,
  MAX_JSON_BODY_BYTES: process.env.MAX_JSON_BODY_BYTES,
  MAX_URLENCODED_BODY_BYTES: process.env.MAX_URLENCODED_BODY_BYTES,
  MAX_MULTIPART_BODY_BYTES: process.env.MAX_MULTIPART_BODY_BYTES,
  MAX_WEBHOOK_BODY_BYTES: process.env.MAX_WEBHOOK_BODY_BYTES,
  MAX_WS_MESSAGE_BYTES: process.env.MAX_WS_MESSAGE_BYTES,
  LOG_LEVEL: process.env.LOG_LEVEL,
})
