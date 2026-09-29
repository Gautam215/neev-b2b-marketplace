import { Router } from 'express'
import { authenticate, requirePermissions } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { inventoryUpdateSchema } from '../schemas/marketplace.js'
import { HttpError } from '../middleware/errors.js'

export const inventoryRouter = Router()

inventoryRouter.patch('/:listingId', authenticate, requirePermissions('inventory:update'), async (request, response) => {
  const input = inventoryUpdateSchema.parse(request.body)
  const listingId = request.params.listingId
  if (!listingId || Array.isArray(listingId)) throw new HttpError(400, 'Listing id is required')
  const listing = await prisma.inventoryListing.findUnique({ where: { id: listingId } })
  if (!listing) throw new HttpError(404, 'Inventory listing not found')
  if (!request.auth!.roles.includes('ops_admin') && listing.supplierId !== request.auth!.organizationId) {
    throw new HttpError(403, 'Listing is outside your organization')
  }

  const versionHeader = request.header('if-match-version')
  if (versionHeader && Number(versionHeader) !== listing.version) throw new HttpError(409, 'Listing version is stale', { currentVersion: listing.version })
  const write = await prisma.inventoryListing.updateMany({
    where: { id: listing.id, version: listing.version },
    data: { ...input, version: { increment: 1 } },
  })
  if (write.count !== 1) throw new HttpError(409, 'Listing changed while you were editing', { currentVersion: listing.version })
  const updated = await prisma.inventoryListing.findUniqueOrThrow({ where: { id: listing.id } })
  response.json({ data: { ...updated, pricePerPiece: updated.pricePerPiece.toString() } })
})
