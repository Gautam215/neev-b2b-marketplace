import { Router } from 'express'
import { Prisma } from '@prisma/client'
import { authenticate, requireRoles } from '../middleware/auth.js'
import { pricingCalculateSchema } from '../schemas/marketplace.js'
import { getPricingRules } from '../lib/pricing-rules.js'

const money = (value: Prisma.Decimal) => value.toFixed(2)

export const pricingRouter = Router()

pricingRouter.post('/calculate', authenticate, requireRoles('buyer', 'buyer_finance', 'supplier', 'ops_admin'), async (request, response) => {
  const input = pricingCalculateSchema.parse(request.body)
  const rules = await getPricingRules()
  const quantity = new Prisma.Decimal(input.quantity)
  const materialSubtotal = quantity.mul(input.unitPrice)
  const tier = [...rules.tiers].sort((left, right) => left.minQuantity - right.minQuantity).reduce((selected, candidate) => candidate.minQuantity <= input.quantity ? candidate : selected, rules.tiers[0]!)
  const volumeDiscount = materialSubtotal.mul(tier.discountBps).div(10000)
  const discountedMaterial = materialSubtotal.sub(volumeDiscount)
  const freight = new Prisma.Decimal(input.distanceKm).mul(rules.fees.freightPerKm)
  const handling = quantity.mul(rules.fees.handlingPerPiece)
  const platformFee = discountedMaterial.mul(rules.fees.platformBps).div(10000)
  const carbonKgPerPiece = input.carbonKgPerPiece ?? rules.fees.defaultCarbonKgPerPiece
  const carbonContribution = input.includeCarbonContribution
    ? quantity.mul(carbonKgPerPiece).mul(rules.fees.carbonContributionPerKg)
    : new Prisma.Decimal(0)
  const taxableSubtotal = discountedMaterial.add(freight).add(handling).add(platformFee).add(carbonContribution)
  const tax = taxableSubtotal.mul(rules.fees.taxBps).div(10000)
  const total = taxableSubtotal.add(tax)

  response.json({
    data: {
      currency: input.currency,
      quantity: input.quantity,
      rulesVersion: rules.version,
      discount: {
        tierMinimum: tier.minQuantity,
        rateBps: tier.discountBps,
        ratePct: tier.discountBps / 100,
        amount: money(volumeDiscount),
      },
      fees: [
        { code: 'material', label: 'Material subtotal', amount: money(materialSubtotal), rate: money(new Prisma.Decimal(input.unitPrice)) },
        { code: 'freight', label: 'Distance freight', amount: money(freight), rate: `${input.distanceKm} km` },
        { code: 'handling', label: 'Handling', amount: money(handling), rate: money(new Prisma.Decimal(rules.fees.handlingPerPiece)) },
        { code: 'platform', label: 'Marketplace fee', amount: money(platformFee), rate: `${rules.fees.platformBps / 100}%` },
        { code: 'carbon', label: 'Carbon contribution', amount: money(carbonContribution), rate: `${carbonKgPerPiece} kg/piece` },
        { code: 'tax', label: 'Tax', amount: money(tax), rate: `${rules.fees.taxBps / 100}%` },
      ],
      totals: {
        beforeTax: money(taxableSubtotal),
        total: money(total),
        effectivePerPiece: money(total.div(quantity)),
      },
    },
  })
})
