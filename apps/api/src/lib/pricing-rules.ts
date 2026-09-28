import { z } from 'zod'
import { logger } from './logger.js'
import { redis } from './redis.js'

const pricingRulesSchema = z.object({
  version: z.string().min(1),
  tiers: z.array(z.object({ minQuantity: z.number().int().positive(), discountBps: z.number().int().min(0).max(5000) })).min(1),
  fees: z.object({
    freightPerKm: z.number().nonnegative(),
    handlingPerPiece: z.number().nonnegative(),
    platformBps: z.number().int().min(0).max(2000),
    taxBps: z.number().int().min(0).max(3000),
    carbonContributionPerKg: z.number().nonnegative(),
    defaultCarbonKgPerPiece: z.number().nonnegative(),
    baselineCarbonKgPerPiece: z.number().nonnegative(),
  }),
})

export type PricingRules = z.infer<typeof pricingRulesSchema>

export const pricingRulesCacheKey = 'neev:pricing:rules:v1'
export const pricingRulesTtlSeconds = 300

export const defaultPricingRules: PricingRules = {
  version: '2026-09-28',
  tiers: [
    { minQuantity: 1000, discountBps: 0 },
    { minQuantity: 5000, discountBps: 200 },
    { minQuantity: 10000, discountBps: 450 },
    { minQuantity: 25000, discountBps: 700 },
    { minQuantity: 50000, discountBps: 1000 },
  ],
  fees: {
    freightPerKm: 3.5,
    handlingPerPiece: 0.08,
    platformBps: 125,
    taxBps: 500,
    carbonContributionPerKg: 1.2,
    defaultCarbonKgPerPiece: 0.55,
    baselineCarbonKgPerPiece: 0.75,
  },
}

export async function getPricingRules(): Promise<PricingRules> {
  if (redis.isReady) {
    try {
      const cached = await redis.get(pricingRulesCacheKey)
      if (cached) return pricingRulesSchema.parse(JSON.parse(cached))
    } catch (error) {
      logger.warn({ err: error, event: 'pricing.rules_cache_read_failed' }, 'using default pricing rules')
    }
  }

  if (redis.isReady) {
    try {
      await redis.setEx(pricingRulesCacheKey, pricingRulesTtlSeconds, JSON.stringify(defaultPricingRules))
    } catch (error) {
      logger.warn({ err: error, event: 'pricing.rules_cache_write_failed' }, 'pricing rules cache write failed')
    }
  }
  return defaultPricingRules
}

export async function invalidatePricingRules() {
  if (redis.isReady) await redis.del(pricingRulesCacheKey)
}
