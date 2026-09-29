import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url().refine((value) => value.startsWith('postgresql://') || value.startsWith('postgres://'), 'DATABASE_URL must be a PostgreSQL URL'),
  DATABASE_SSL_MODE: z.enum(['disable', 'prefer', 'require']).default('prefer'),
  DATABASE_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  DATABASE_POOL_TIMEOUT_SECONDS: z.coerce.number().int().min(1).max(120).default(10),
  REDIS_URL: z.string().url(),
  MONGODB_URL: z.string().url().optional(),
  MONGODB_URI: z.string().url().optional(),
  MONGODB_DATABASE: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).default('neev'),
  MONGODB_POOL_SIZE: z.coerce.number().int().min(1).max(100).default(10),
  MONGODB_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(5_000),
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(5_000),
  MONGODB_TLS: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  MONGODB_ENCRYPTION_KEY: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).optional(),
  JWT_SECRET: z.string().min(32),
  JWT_ISSUER: z.string().min(1).default('neev-api'),
  JWT_AUDIENCE: z.string().min(1).default('neev-web'),
  JWT_CLOCK_TOLERANCE_SECONDS: z.coerce.number().int().min(0).max(120).default(5),
  AUTH_REQUIRE_USER_LOOKUP: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16),
  PAYMENT_WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().min(30).max(3600).default(900),
  WEB_ORIGIN: z.string().url(),
  MAX_JSON_BODY_BYTES: z.coerce.number().int().min(1024).max(1024 * 1024).default(64 * 1024),
  MAX_URLENCODED_BODY_BYTES: z.coerce.number().int().min(1024).max(256 * 1024).default(32 * 1024),
  MAX_MULTIPART_BODY_BYTES: z.coerce.number().int().min(1024).max(10 * 1024 * 1024).default(5 * 1024 * 1024),
  MAX_WEBHOOK_BODY_BYTES: z.coerce.number().int().min(1024).max(1024 * 1024).default(256 * 1024),
  MAX_WS_MESSAGE_BYTES: z.coerce.number().int().min(1024).max(1024 * 1024).default(64 * 1024),
  STARTUP_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
  HEALTH_CHECK_TIMEOUT_MS: z.coerce.number().int().min(100).max(30_000).default(5_000),
  SEED_ON_START: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  SEED_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(600_000).default(120_000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && value.DATABASE_SSL_MODE !== 'require') {
    context.addIssue({ code: 'custom', path: ['DATABASE_SSL_MODE'], message: 'DATABASE_SSL_MODE=require is required in production' })
  }
  if (Boolean(value.MONGODB_URL) !== Boolean(value.MONGODB_ENCRYPTION_KEY)) {
    context.addIssue({ code: 'custom', path: ['MONGODB_ENCRYPTION_KEY'], message: 'MONGODB_ENCRYPTION_KEY is required when MONGODB_URL is configured' })
  }
  if (value.MONGODB_URL && value.MONGODB_URI && value.MONGODB_URL !== value.MONGODB_URI) {
    context.addIssue({ code: 'custom', path: ['MONGODB_URI'], message: 'MONGODB_URI must match MONGODB_URL when both are configured' })
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
  DATABASE_SSL_MODE: process.env.DATABASE_SSL_MODE,
  DATABASE_POOL_SIZE: process.env.DATABASE_POOL_SIZE,
  DATABASE_POOL_TIMEOUT_SECONDS: process.env.DATABASE_POOL_TIMEOUT_SECONDS,
  REDIS_URL: process.env.REDIS_URL,
  MONGODB_URL: process.env.MONGODB_URL,
  MONGODB_URI: process.env.MONGODB_URI,
  MONGODB_DATABASE: process.env.MONGODB_DATABASE,
  MONGODB_POOL_SIZE: process.env.MONGODB_POOL_SIZE,
  MONGODB_CONNECT_TIMEOUT_MS: process.env.MONGODB_CONNECT_TIMEOUT_MS,
  MONGODB_SERVER_SELECTION_TIMEOUT_MS: process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
  MONGODB_TLS: process.env.MONGODB_TLS,
  MONGODB_ENCRYPTION_KEY: process.env.MONGODB_ENCRYPTION_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_ISSUER: process.env.JWT_ISSUER,
  JWT_AUDIENCE: process.env.JWT_AUDIENCE,
  JWT_CLOCK_TOLERANCE_SECONDS: process.env.JWT_CLOCK_TOLERANCE_SECONDS,
  AUTH_REQUIRE_USER_LOOKUP: process.env.AUTH_REQUIRE_USER_LOOKUP,
  PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET,
  PAYMENT_WEBHOOK_TOLERANCE_SECONDS: process.env.PAYMENT_WEBHOOK_TOLERANCE_SECONDS,
  WEB_ORIGIN: process.env.WEB_ORIGIN,
  MAX_JSON_BODY_BYTES: process.env.MAX_JSON_BODY_BYTES,
  MAX_URLENCODED_BODY_BYTES: process.env.MAX_URLENCODED_BODY_BYTES,
  MAX_MULTIPART_BODY_BYTES: process.env.MAX_MULTIPART_BODY_BYTES,
  MAX_WEBHOOK_BODY_BYTES: process.env.MAX_WEBHOOK_BODY_BYTES,
  MAX_WS_MESSAGE_BYTES: process.env.MAX_WS_MESSAGE_BYTES,
  STARTUP_TIMEOUT_MS: process.env.STARTUP_TIMEOUT_MS,
  SHUTDOWN_TIMEOUT_MS: process.env.SHUTDOWN_TIMEOUT_MS,
  HEALTH_CHECK_TIMEOUT_MS: process.env.HEALTH_CHECK_TIMEOUT_MS,
  SEED_ON_START: process.env.SEED_ON_START,
  SEED_TIMEOUT_MS: process.env.SEED_TIMEOUT_MS,
  LOG_LEVEL: process.env.LOG_LEVEL,
})
