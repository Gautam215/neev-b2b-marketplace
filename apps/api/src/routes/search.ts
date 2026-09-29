import { Router } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { searchQuerySchema } from '../schemas/marketplace.js'
import { authenticate, requirePermissions } from '../middleware/auth.js'

export const searchRouter = Router()

searchRouter.get('/', authenticate, requirePermissions('catalog:read'), async (request, response) => {
  const query = searchQuerySchema.parse(request.query)
  const where: Prisma.InventoryListingWhereInput = {
    ...(query.q ? { OR: [{ sku: { contains: query.q, mode: 'insensitive' } }, { grade: { contains: query.q, mode: 'insensitive' } }] } : {}),
    ...(query.grade ? { grade: { equals: query.grade, mode: 'insensitive' } } : {}),
    ...(query.location ? { location: { contains: query.location, mode: 'insensitive' } } : {}),
    ...(query.minPieces ? { availablePieces: { gte: query.minPieces } } : {}),
    publishedAt: { gte: new Date(Date.now() - query.freshWithinHours * 60 * 60 * 1000) },
  }
  const listings = await prisma.inventoryListing.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 50 })
  response.json({ data: listings.map((listing) => ({ ...listing, pricePerPiece: listing.pricePerPiece.toString() })) })
})
