import { z } from 'zod'

export const searchQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  grade: z.string().trim().max(40).optional(),
  location: z.string().trim().max(80).optional(),
  minPieces: z.coerce.number().int().positive().optional(),
  freshWithinHours: z.coerce.number().int().positive().max(720).default(72),
})

export const quoteRequestSchema = z.object({
  quantity: z.number().int().min(1000).max(5000000),
  deliveryArea: z.string().trim().min(3).max(160),
  targetDate: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
})

export const inventoryUpdateSchema = z.object({
  availablePieces: z.number().int().nonnegative().max(50000000),
  pricePerPiece: z.number().positive().max(100000),
  grade: z.string().trim().min(1).max(40),
  leadTimeDays: z.number().int().min(0).max(90),
})

export const dispatchSchema = z.object({
  orderId: z.string().min(1),
  slot: z.coerce.date(),
  vehicleReference: z.string().trim().min(2).max(80),
  proofUrl: z.string().url().optional(),
})

export const quoteAcceptSchema = z.object({
  quoteVersion: z.number().int().positive(),
})

export const paymentIntentSchema = z.object({
  orderId: z.string().min(1),
  gateway: z.enum(['razorpay', 'stripe']),
})

export const pricingCalculateSchema = z.object({
  quantity: z.coerce.number().int().min(1000).max(5000000),
  unitPrice: z.coerce.number().positive().max(100000),
  distanceKm: z.coerce.number().min(0).max(5000).default(0),
  carbonKgPerPiece: z.coerce.number().min(0).max(10).optional(),
  includeCarbonContribution: z.boolean().default(true),
  currency: z.literal('INR').default('INR'),
}).strict()

export const sustainabilityQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).strict().refine(({ from, to }) => !from || !to || from <= to, { message: 'from must be before to' })

export const sustainabilityMetricSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  baselineKg: z.coerce.number().positive().max(100000000),
  actualKg: z.coerce.number().nonnegative().max(100000000),
  recycledSharePct: z.coerce.number().min(0).max(100),
  methodology: z.string().trim().min(3).max(120),
  orderId: z.string().min(1).optional(),
}).strict().superRefine((value, context) => {
  if (value.periodStart >= value.periodEnd) context.addIssue({ code: 'custom', path: ['periodEnd'], message: 'periodEnd must be after periodStart' })
  if (value.actualKg > value.baselineKg) context.addIssue({ code: 'custom', path: ['actualKg'], message: 'actualKg cannot exceed baselineKg' })
})
