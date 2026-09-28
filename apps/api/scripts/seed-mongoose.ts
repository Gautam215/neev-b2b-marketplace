import 'dotenv/config'
import mongoose from 'mongoose'

const SEED_VERSION = process.env.SEED_VERSION ?? 'prd-v1-2026-09-28'
const mongoUri = process.env.MONGODB_URI ?? process.env.MONGODB_URL
const databaseName = process.env.MONGODB_DATABASE ?? 'neev'
const maxPoolSize = Number(process.env.MONGODB_POOL_SIZE ?? 10)
const serverSelectionTimeoutMS = Number(process.env.MONGODB_SERVER_SELECTION_TIMEOUT_MS ?? 5_000)

type SeedDocument = Record<string, unknown> & { seedKey: string; seedVersion: string }

const date = (value: string) => new Date(`${value}T00:00:00.000Z`)
const seeded = <T extends Record<string, unknown>>(seedKey: string, document: T): T & SeedDocument => ({ seedKey, seedVersion: SEED_VERSION, ...document })

const commonOptions = { timestamps: true, versionKey: false as const, strict: true as const }

const userSchema = new mongoose.Schema({
  seedKey: { type: String, required: true },
  seedVersion: { type: String, required: true },
  id: { type: String, required: true },
  email: { type: String, required: true },
  displayName: { type: String, required: true },
  role: { type: String, required: true, enum: ['MANUFACTURER', 'DEALER', 'CONTRACTOR', 'ADMIN', 'OPS'] },
  status: { type: String, required: true, enum: ['VERIFIED', 'PENDING', 'BLOCKED'] },
  organizationId: { type: String, required: true },
  lastLoginAt: { type: Date, required: true },
}, { ...commonOptions, collection: 'demo_users' })

const vendorSchema = new mongoose.Schema({
  seedKey: { type: String, required: true },
  seedVersion: { type: String, required: true },
  id: { type: String, required: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  vendorType: { type: String, required: true },
  zone: { type: String, required: true },
  address: { type: String, required: true },
  serviceRadiusKm: { type: Number, required: true, min: 1 },
  verificationStatus: { type: String, required: true, enum: ['VERIFIED', 'PENDING', 'PAUSED'] },
  operatingHours: { type: String, required: true },
  rating: { type: Number, required: true, min: 0, max: 5 },
  reviewCount: { type: Number, required: true, min: 0 },
  active: { type: Boolean, required: true },
}, { ...commonOptions, collection: 'demo_vendors' })

const productSchema = new mongoose.Schema({
  seedKey: { type: String, required: true },
  seedVersion: { type: String, required: true },
  id: { type: String, required: true },
  vendorId: { type: String, required: true },
  sku: { type: String, required: true },
  name: { type: String, required: true },
  brickType: { type: String, required: true },
  dimensions: { type: String, required: true },
  grade: { type: String, required: true },
  unit: { type: String, required: true, enum: ['piece'] },
  moq: { type: Number, required: true, min: 1 },
  pricePerPiece: { type: Number, required: true, min: 0 },
  active: { type: Boolean, required: true },
}, { ...commonOptions, collection: 'demo_products' })

const inventorySchema = new mongoose.Schema({
  seedKey: { type: String, required: true },
  seedVersion: { type: String, required: true },
  id: { type: String, required: true },
  vendorId: { type: String, required: true },
  productId: { type: String, required: true },
  sku: { type: String, required: true },
  onHandQty: { type: Number, required: true, min: 0 },
  reservedQty: { type: Number, required: true, min: 0 },
  availableQty: { type: Number, required: true, min: 0 },
  source: { type: String, required: true },
  confidence: { type: String, required: true, enum: ['HIGH', 'MEDIUM', 'LOW'] },
  freshnessMinutes: { type: Number, required: true, min: 0 },
  status: { type: String, required: true, enum: ['AVAILABLE', 'LOW_STOCK', 'PAUSED', 'REVIEW', 'STALE'] },
}, { ...commonOptions, collection: 'demo_inventory' })

const orderSchema = new mongoose.Schema({
  seedKey: { type: String, required: true },
  seedVersion: { type: String, required: true },
  id: { type: String, required: true },
  buyerId: { type: String, required: true },
  vendorId: { type: String, required: true },
  siteAddress: { type: String, required: true },
  status: { type: String, required: true, enum: ['DRAFT', 'QUOTED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'DISPUTED', 'CANCELLED'] },
  quantity: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true, min: 0 },
  freight: { type: Number, required: true, min: 0 },
  tax: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  idempotencyKey: { type: String, required: true },
  deliveryWindow: { type: String, required: true },
  exceptionReason: { type: String },
}, { ...commonOptions, collection: 'demo_orders' })

const quoteSchema = new mongoose.Schema({
  seedKey: { type: String, required: true },
  seedVersion: { type: String, required: true },
  id: { type: String, required: true },
  buyerId: { type: String, required: true },
  vendorId: { type: String, required: true },
  status: { type: String, required: true, enum: ['AWAITING_RESPONSE', 'COUNTERED', 'ACCEPTED', 'EXPIRED', 'REVIEW_REQUIRED'] },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  freight: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  deliveryWindow: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  latestVersion: { type: Number, required: true, min: 1 },
  versions: { type: [mongoose.Schema.Types.Mixed], required: true },
}, { ...commonOptions, collection: 'demo_quotes' })

const pricingTierSchema = new mongoose.Schema({
  seedKey: { type: String, required: true },
  seedVersion: { type: String, required: true },
  productFamily: { type: String, required: true },
  minQuantity: { type: Number, required: true, min: 1 },
  maxQuantity: { type: Number, required: true, min: 1 },
  discountPercent: { type: Number, required: true, min: 0, max: 50 },
  discountBps: { type: Number, required: true, min: 0, max: 5000 },
  currency: { type: String, required: true, enum: ['INR'] },
  effectiveFrom: { type: Date, required: true },
  active: { type: Boolean, required: true },
}, { ...commonOptions, collection: 'pricing_tiers' })

const volumeDiscountSchema = new mongoose.Schema({
  seedKey: { type: String, required: true },
  seedVersion: { type: String, required: true },
  code: { type: String, required: true },
  label: { type: String, required: true },
  minQuantity: { type: Number, required: true, min: 1 },
  maxQuantity: { type: Number, required: true, min: 1 },
  discountPercent: { type: Number, required: true, min: 0, max: 50 },
  stackable: { type: Boolean, required: true },
  eligibility: { type: String, required: true },
  effectiveFrom: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  active: { type: Boolean, required: true },
}, { ...commonOptions, collection: 'volume_discounts' })

const logisticsFeeSchema = new mongoose.Schema({
  seedKey: { type: String, required: true },
  seedVersion: { type: String, required: true },
  zone: { type: String, required: true },
  minDistanceKm: { type: Number, required: true, min: 0 },
  maxDistanceKm: { type: Number, required: true, min: 0 },
  baseFee: { type: Number, required: true, min: 0 },
  perKmFee: { type: Number, required: true, min: 0 },
  perPieceFee: { type: Number, required: true, min: 0 },
  fuelSurchargePercent: { type: Number, required: true, min: 0, max: 100 },
  vehicleType: { type: String, required: true },
  currency: { type: String, required: true, enum: ['INR'] },
  effectiveFrom: { type: Date, required: true },
  active: { type: Boolean, required: true },
}, { ...commonOptions, collection: 'logistics_fees' })

const taxRateSchema = new mongoose.Schema({
  seedKey: { type: String, required: true },
  seedVersion: { type: String, required: true },
  code: { type: String, required: true },
  name: { type: String, required: true },
  jurisdiction: { type: String, required: true },
  appliesTo: { type: [String], required: true },
  ratePercent: { type: Number, required: true, min: 0, max: 100 },
  effectiveFrom: { type: Date, required: true },
  active: { type: Boolean, required: true },
}, { ...commonOptions, collection: 'tax_rates' })

const sustainabilityMetricSchema = new mongoose.Schema({
  seedKey: { type: String, required: true },
  seedVersion: { type: String, required: true },
  organizationId: { type: String, required: true },
  orderId: { type: String, required: true },
  periodStart: { type: Date, required: true },
  periodEnd: { type: Date, required: true },
  baselineKg: { type: Number, required: true, min: 0 },
  actualKg: { type: Number, required: true, min: 0 },
  reducedKg: { type: Number, required: true, min: 0 },
  recycledSharePct: { type: Number, required: true, min: 0, max: 100 },
  methodology: { type: String, required: true },
  source: { type: String, required: true },
  verified: { type: Boolean, required: true },
}, { ...commonOptions, collection: 'sustainability_metrics' })

const mockTestDataSchema = new mongoose.Schema({
  seedKey: { type: String, required: true },
  seedVersion: { type: String, required: true },
  category: { type: String, required: true },
  scenario: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  expected: { type: mongoose.Schema.Types.Mixed, required: true },
  tags: { type: [String], required: true },
}, { ...commonOptions, collection: 'mock_test_data' })

const seedRunSchema = new mongoose.Schema({
  seedVersion: { type: String, required: true },
  source: { type: String, required: true },
  counts: { type: mongoose.Schema.Types.Mixed, required: true },
  executedAt: { type: Date, required: true },
}, { ...commonOptions, collection: 'seed_runs' })

for (const schema of [pricingTierSchema, volumeDiscountSchema, logisticsFeeSchema, taxRateSchema, sustainabilityMetricSchema, mockTestDataSchema]) {
  schema.index({ seedKey: 1, seedVersion: 1 }, { unique: true })
}
for (const schema of [userSchema, vendorSchema, productSchema, inventorySchema, orderSchema, quoteSchema]) {
  schema.index({ seedKey: 1, seedVersion: 1 }, { unique: true })
}
seedRunSchema.index({ seedVersion: 1 }, { unique: true })

const DemoUser = mongoose.models.DemoUser ?? mongoose.model('DemoUser', userSchema)
const DemoVendor = mongoose.models.DemoVendor ?? mongoose.model('DemoVendor', vendorSchema)
const DemoProduct = mongoose.models.DemoProduct ?? mongoose.model('DemoProduct', productSchema)
const DemoInventory = mongoose.models.DemoInventory ?? mongoose.model('DemoInventory', inventorySchema)
const DemoOrder = mongoose.models.DemoOrder ?? mongoose.model('DemoOrder', orderSchema)
const DemoQuote = mongoose.models.DemoQuote ?? mongoose.model('DemoQuote', quoteSchema)
const PricingTier = mongoose.models.PricingTier ?? mongoose.model('PricingTier', pricingTierSchema)
const VolumeDiscount = mongoose.models.VolumeDiscount ?? mongoose.model('VolumeDiscount', volumeDiscountSchema)
const LogisticsFee = mongoose.models.LogisticsFee ?? mongoose.model('LogisticsFee', logisticsFeeSchema)
const TaxRate = mongoose.models.TaxRate ?? mongoose.model('TaxRate', taxRateSchema)
const SustainabilityMetric = mongoose.models.SustainabilityMetric ?? mongoose.model('SustainabilityMetric', sustainabilityMetricSchema)
const MockTestData = mongoose.models.MockTestData ?? mongoose.model('MockTestData', mockTestDataSchema)
const SeedRun = mongoose.models.SeedRun ?? mongoose.model('SeedRun', seedRunSchema)

const demoUsers = [
  seeded('user-001', { id: 'NEEV-DEMO-USER-001', email: 'demo.contractor@neev.example', displayName: 'Arjun Mehta', role: 'CONTRACTOR', status: 'VERIFIED', organizationId: 'org-arjun-construction', lastLoginAt: date('2026-09-28') }),
  seeded('user-002', { id: 'NEEV-DEMO-USER-002', email: 'site.lead@neev.example', displayName: 'Shalini Kapoor', role: 'CONTRACTOR', status: 'VERIFIED', organizationId: 'org-sector-62-build', lastLoginAt: date('2026-09-27') }),
  seeded('user-003', { id: 'NEEV-DEMO-USER-003', email: 'procurement@neev.example', displayName: 'Rohit Malhotra', role: 'CONTRACTOR', status: 'VERIFIED', organizationId: 'org-phase-two-build', lastLoginAt: date('2026-09-26') }),
  seeded('user-004', { id: 'NEEV-DEMO-USER-004', email: 'pending.contractor@neev.example', displayName: 'Neha Bansal', role: 'CONTRACTOR', status: 'PENDING', organizationId: 'org-pending-contractor', lastLoginAt: date('2026-09-20') }),
  seeded('user-005', { id: 'NEEV-DEMO-USER-005', email: 'shakti.ops@neev.example', displayName: 'Raghav Sharma', role: 'MANUFACTURER', status: 'VERIFIED', organizationId: 'org-shakti-kiln-works', lastLoginAt: date('2026-09-28') }),
  seeded('user-006', { id: 'NEEV-DEMO-USER-006', email: 'narmada.ops@neev.example', displayName: 'Karan Sethi', role: 'DEALER', status: 'VERIFIED', organizationId: 'org-narmada-brick-depot', lastLoginAt: date('2026-09-27') }),
  seeded('user-007', { id: 'NEEV-DEMO-USER-007', email: 'aravali.ops@neev.example', displayName: 'Meera Joshi', role: 'MANUFACTURER', status: 'VERIFIED', organizationId: 'org-aravali-clay-house', lastLoginAt: date('2026-09-27') }),
  seeded('user-008', { id: 'NEEV-DEMO-USER-008', email: 'yamuna.ops@neev.example', displayName: 'Vikram Rao', role: 'DEALER', status: 'PAUSED', organizationId: 'org-yamuna-build-mart', lastLoginAt: date('2026-09-18') }),
  seeded('user-009', { id: 'NEEV-DEMO-USER-009', email: 'admin@neev.example', displayName: 'Operations Admin', role: 'ADMIN', status: 'VERIFIED', organizationId: 'org-neev-operations', lastLoginAt: date('2026-09-28') }),
  seeded('user-010', { id: 'NEEV-DEMO-USER-010', email: 'ops.review@neev.example', displayName: 'Operations Reviewer', role: 'OPS', status: 'VERIFIED', organizationId: 'org-neev-operations', lastLoginAt: date('2026-09-28') }),
  seeded('user-011', { id: 'NEEV-DEMO-USER-011', email: 'blocked.vendor@neev.example', displayName: 'Blocked Demo Vendor', role: 'DEALER', status: 'BLOCKED', organizationId: 'org-blocked-vendor', lastLoginAt: date('2026-08-30') }),
  seeded('user-012', { id: 'NEEV-DEMO-USER-012', email: 'finance@neev.example', displayName: 'Buyer Finance Desk', role: 'CONTRACTOR', status: 'VERIFIED', organizationId: 'org-arjun-construction', lastLoginAt: date('2026-09-28') }),
]

const demoVendors = [
  seeded('vendor-001', { id: 'NEEV-DEMO-V-001', code: 'SKW', name: 'Shakti Kiln Works', vendorType: 'Manufacturer', zone: 'Dadri / NCR East', address: 'Dadri kiln cluster, Gautam Buddh Nagar', serviceRadiusKm: 35, verificationStatus: 'VERIFIED', operatingHours: '06:00-18:00 Mon-Sat', rating: 4.8, reviewCount: 124, active: true }),
  seeded('vendor-002', { id: 'NEEV-DEMO-V-002', code: 'NBD', name: 'Narmada Brick Depot', vendorType: 'Dealer', zone: 'Sector 62 / Noida', address: 'Sector 62 materials market, Noida', serviceRadiusKm: 28, verificationStatus: 'VERIFIED', operatingHours: '07:00-19:00 Mon-Sat', rating: 4.7, reviewCount: 88, active: true }),
  seeded('vendor-003', { id: 'NEEV-DEMO-V-003', code: 'ACH', name: 'Aravali Clay House', vendorType: 'Manufacturer', zone: 'Greater Noida', address: 'Surajpur industrial area, Greater Noida', serviceRadiusKm: 32, verificationStatus: 'VERIFIED', operatingHours: '06:30-18:30 Mon-Sat', rating: 4.5, reviewCount: 61, active: true }),
  seeded('vendor-004', { id: 'NEEV-DEMO-V-004', code: 'YBM', name: 'Yamuna Build Mart', vendorType: 'Dealer', zone: 'Yamuna Expressway', address: 'Kasna logistics park, Greater Noida', serviceRadiusKm: 45, verificationStatus: 'PAUSED', operatingHours: '08:00-18:00 Mon-Fri', rating: 4.3, reviewCount: 43, active: false }),
  seeded('vendor-005', { id: 'NEEV-DEMO-V-005', code: 'MAM', name: 'Mitti & Mortar Co.', vendorType: 'Manufacturer', zone: 'Loni / East NCR', address: 'Loni road kiln cluster, Ghaziabad', serviceRadiusKm: 30, verificationStatus: 'VERIFIED', operatingHours: '06:00-17:30 Mon-Sat', rating: 4.4, reviewCount: 52, active: true }),
  seeded('vendor-006', { id: 'NEEV-DEMO-V-006', code: 'BRT', name: 'Brickline Traders', vendorType: 'Dealer', zone: 'Crossings Republik', address: 'Crossings Republik trade yard, Ghaziabad', serviceRadiusKm: 24, verificationStatus: 'VERIFIED', operatingHours: '07:30-18:30 Mon-Sat', rating: 4.2, reviewCount: 37, active: true }),
  seeded('vendor-007', { id: 'NEEV-DEMO-V-007', code: 'KEW', name: 'Khurja Earthworks', vendorType: 'Manufacturer', zone: 'Khurja / Bulandshahr', address: 'Khurja ceramic and brick belt', serviceRadiusKm: 50, verificationStatus: 'VERIFIED', operatingHours: '05:30-18:00 Mon-Sat', rating: 4.6, reviewCount: 74, active: true }),
  seeded('vendor-008', { id: 'NEEV-DEMO-V-008', code: 'MBS', name: 'Metro Brick Supply', vendorType: 'Dealer', zone: 'East Delhi border', address: 'Patparganj building materials yard, Delhi', serviceRadiusKm: 22, verificationStatus: 'PENDING', operatingHours: '08:00-17:00 Mon-Fri', rating: 4.1, reviewCount: 19, active: false }),
]

const productVariants = [
  { name: 'First-class red brick', brickType: 'RED_CLAY', dimensions: '230 x 110 x 75 mm', grade: 'A+', moq: 5_000, pricePerPiece: 7.08 },
  { name: 'Wire-cut red brick', brickType: 'WIRE_CUT', dimensions: '230 x 110 x 75 mm', grade: 'A', moq: 5_000, pricePerPiece: 6.84 },
  { name: 'Low-carbon fly ash brick', brickType: 'FLY_ASH', dimensions: '230 x 110 x 75 mm', grade: 'A', moq: 1_000, pricePerPiece: 8.2 },
]

const demoProducts = demoVendors.flatMap((vendor, vendorIndex) => productVariants.map((variant, variantIndex) => {
  const number = vendorIndex * productVariants.length + variantIndex + 1
  const pricePerPiece = Number((variant.pricePerPiece + (vendorIndex % 4) * 0.06).toFixed(2))
  return seeded(`product-${String(number).padStart(3, '0')}`, {
    id: `NEEV-DEMO-P-${String(number).padStart(3, '0')}`,
    vendorId: vendor.id,
    sku: `${vendor.code}-${variant.brickType}-${String(variantIndex + 1).padStart(3, '0')}`,
    ...variant,
    pricePerPiece,
    unit: 'piece',
    active: vendor.active && variantIndex !== 2 || vendorIndex === 6,
  })
}))

const stockProfiles = [
  { onHandQty: 42_000, reservedQty: 8_000, freshnessMinutes: 18, confidence: 'HIGH', source: 'VENDOR_SYNC' },
  { onHandQty: 31_800, reservedQty: 6_800, freshnessMinutes: 42, confidence: 'MEDIUM', source: 'VENDOR_SYNC' },
  { onHandQty: 27_800, reservedQty: 4_100, freshnessMinutes: 60, confidence: 'MEDIUM', source: 'VENDOR_SYNC' },
  { onHandQty: 22_000, reservedQty: 5_200, freshnessMinutes: 420, confidence: 'LOW', source: 'MANUAL_UPDATE' },
  { onHandQty: 16_400, reservedQty: 1_200, freshnessMinutes: 540, confidence: 'LOW', source: 'MANUAL_UPDATE' },
  { onHandQty: 9_600, reservedQty: 2_200, freshnessMinutes: 120, confidence: 'MEDIUM', source: 'VENDOR_SYNC' },
  { onHandQty: 39_000, reservedQty: 5_000, freshnessMinutes: 12, confidence: 'HIGH', source: 'VENDOR_SYNC' },
  { onHandQty: 7_800, reservedQty: 3_600, freshnessMinutes: 2_880, confidence: 'LOW', source: 'MANUAL_UPDATE' },
]

const demoInventory = demoProducts.map((product, index) => {
  const profile = stockProfiles[Math.floor(index / productVariants.length)]!
  const availableQty = profile.onHandQty - profile.reservedQty
  const status = profile.freshnessMinutes > 1_440 ? 'STALE' : availableQty < 10_000 ? 'LOW_STOCK' : profile.confidence === 'LOW' ? 'REVIEW' : 'AVAILABLE'
  return seeded(`inventory-${String(index + 1).padStart(3, '0')}`, { id: `NEEV-DEMO-INV-${String(index + 1).padStart(3, '0')}`, vendorId: product.vendorId, productId: product.id, sku: product.sku, ...profile, availableQty, status })
})

const buyerUsers = demoUsers.filter((user) => user.role === 'CONTRACTOR' && user.status === 'VERIFIED')
const orderIds = ['NEEV-DEMO-1042', 'NEEV-DEMO-1038', 'NEEV-DEMO-1034', 'NEEV-DEMO-1029', ...Array.from({ length: 14 }, (_, index) => `NEEV-DEMO-${String(1050 + index)}`)]
const orderStatuses = ['DISPATCHED', 'DELIVERED', 'DISPUTED', 'CANCELLED', 'DRAFT', 'QUOTED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'CONFIRMED', 'DISPATCHED', 'DELIVERED', 'QUOTED', 'CONFIRMED', 'DISPUTED', 'DELIVERED', 'CANCELLED', 'DRAFT'] as const
const orderSites = ['Sector 18, Noida', 'Phase 2, Noida', 'Sector 62, Noida', 'Sector 15, Noida', 'North Ring Road, Noida']

const demoOrders = orderIds.map((id, index) => {
  const product = demoProducts[index % demoProducts.length]!
  const vendor = demoVendors[index % demoVendors.length]!
  const buyer = buyerUsers[index % buyerUsers.length]!
  const quantity = [25_000, 12_000, 8_000, 6_000, 40_000, 5_000][index % 6]!
  const subtotal = Number((quantity * product.pricePerPiece).toFixed(2))
  const freight = [5_400, 4_200, 7_800, 8_600, 9_200][index % 5]!
  const tax = Number((subtotal * 0.05).toFixed(2))
  const status = orderStatuses[index]!
  return seeded(`order-${id}`, {
    id,
    buyerId: buyer.id,
    vendorId: vendor.id,
    siteAddress: orderSites[index % orderSites.length],
    status,
    quantity,
    subtotal,
    freight,
    tax,
    total: Number((subtotal + freight + tax).toFixed(2)),
    idempotencyKey: `idem-${id}`,
    deliveryWindow: ['02-03 Oct', '04-05 Oct', '06 Oct', 'Review required'][index % 4]!,
    ...(status === 'DISPUTED' ? { exceptionReason: 'Quality mismatch reported; photos attached.' } : {}),
  })
})

const quoteIds = ['NEEV-DEMO-Q-104', 'NEEV-DEMO-Q-105', 'NEEV-DEMO-Q-106', 'NEEV-DEMO-Q-107', ...Array.from({ length: 26 }, (_, index) => `NEEV-DEMO-Q-${String(200 + index)}`)]
const quoteStatuses = ['COUNTERED', 'AWAITING_RESPONSE', 'ACCEPTED', 'EXPIRED', 'REVIEW_REQUIRED'] as const

const demoQuotes = quoteIds.map((id, index) => {
  const product = demoProducts[index % demoProducts.length]!
  const vendor = demoVendors[index % demoVendors.length]!
  const buyer = buyerUsers[index % buyerUsers.length]!
  const quantity = [25_000, 12_000, 8_000, 5_000, 40_000][index % 5]!
  const unitPrice = product.pricePerPiece
  const freight = [5_400, 4_200, 7_800, 6_200][index % 4]!
  const versionCount = (index % 3) + 1
  const versions = Array.from({ length: versionCount }, (_, versionIndex) => ({
    version: versionIndex + 1,
    createdBy: versionIndex % 2 === 0 ? vendor.id : buyer.id,
    createdAt: date(`2026-09-${String(20 + Math.min(index, 8)).padStart(2, '0')}`),
    unitPrice: Number((unitPrice + (versionCount - versionIndex - 1) * 0.08).toFixed(2)),
    freight,
    notes: versionIndex === versionCount - 1 ? 'Terms confirmed for demo review.' : 'Counteroffer retained as immutable history.',
  }))
  return seeded(`quote-${id}`, {
    id,
    buyerId: buyer.id,
    vendorId: vendor.id,
    status: quoteStatuses[index % quoteStatuses.length],
    quantity,
    unitPrice,
    freight,
    total: Number((quantity * unitPrice + freight).toFixed(2)),
    deliveryWindow: ['02-03 Oct', '03-04 Oct', '04-05 Oct'][index % 3]!,
    expiresAt: date(index % 4 === 3 ? '2026-09-27' : '2026-10-02'),
    latestVersion: versionCount,
    versions,
  })
})

const pricingTiers = [
  seeded('pricing-tier-1000', { productFamily: 'red-brick', minQuantity: 1_000, maxQuantity: 4_999, discountPercent: 0, discountBps: 0, currency: 'INR', effectiveFrom: date('2026-09-01'), active: true }),
  seeded('pricing-tier-5000', { productFamily: 'red-brick', minQuantity: 5_000, maxQuantity: 9_999, discountPercent: 2, discountBps: 200, currency: 'INR', effectiveFrom: date('2026-09-01'), active: true }),
  seeded('pricing-tier-10000', { productFamily: 'red-brick', minQuantity: 10_000, maxQuantity: 24_999, discountPercent: 4.5, discountBps: 450, currency: 'INR', effectiveFrom: date('2026-09-01'), active: true }),
  seeded('pricing-tier-25000', { productFamily: 'red-brick', minQuantity: 25_000, maxQuantity: 49_999, discountPercent: 7, discountBps: 700, currency: 'INR', effectiveFrom: date('2026-09-01'), active: true }),
  seeded('pricing-tier-50000', { productFamily: 'red-brick', minQuantity: 50_000, maxQuantity: 5_000_000, discountPercent: 10, discountBps: 1000, currency: 'INR', effectiveFrom: date('2026-09-01'), active: true }),
]

const volumeDiscounts = [
  seeded('volume-discount-contractor-5000', { code: 'CONTRACTOR-5000', label: 'Contractor volume 5k+', minQuantity: 5_000, maxQuantity: 9_999, discountPercent: 2, stackable: false, eligibility: 'verified_contractor', effectiveFrom: date('2026-09-01'), expiresAt: date('2026-12-31'), active: true }),
  seeded('volume-discount-contractor-10000', { code: 'CONTRACTOR-10000', label: 'Contractor volume 10k+', minQuantity: 10_000, maxQuantity: 24_999, discountPercent: 4.5, stackable: false, eligibility: 'verified_contractor', effectiveFrom: date('2026-09-01'), expiresAt: date('2026-12-31'), active: true }),
  seeded('volume-discount-project-25000', { code: 'PROJECT-25000', label: 'Project volume 25k+', minQuantity: 25_000, maxQuantity: 49_999, discountPercent: 7, stackable: false, eligibility: 'approved_project', effectiveFrom: date('2026-09-01'), expiresAt: date('2027-03-31'), active: true }),
  seeded('volume-discount-project-50000', { code: 'PROJECT-50000', label: 'Project volume 50k+', minQuantity: 50_000, maxQuantity: 5_000_000, discountPercent: 10, stackable: false, eligibility: 'approved_project', effectiveFrom: date('2026-09-01'), expiresAt: date('2027-03-31'), active: true }),
  seeded('volume-discount-low-carbon', { code: 'LOW-CARBON-5000', label: 'Lower-carbon material incentive', minQuantity: 5_000, maxQuantity: 5_000_000, discountPercent: 1.5, stackable: true, eligibility: 'low_carbon_certified_sku', effectiveFrom: date('2026-09-01'), expiresAt: date('2026-12-31'), active: true }),
]

const logisticsFees = [
  seeded('logistics-ncr-east-0-15', { zone: 'NCR_EAST', minDistanceKm: 0, maxDistanceKm: 15, baseFee: 1_800, perKmFee: 85, perPieceFee: 0.04, fuelSurchargePercent: 5, vehicleType: '10T rigid', currency: 'INR', effectiveFrom: date('2026-09-01'), active: true }),
  seeded('logistics-ncr-east-15-25', { zone: 'NCR_EAST', minDistanceKm: 15, maxDistanceKm: 25, baseFee: 2_200, perKmFee: 95, perPieceFee: 0.05, fuelSurchargePercent: 7.5, vehicleType: '14T multi-axle', currency: 'INR', effectiveFrom: date('2026-09-01'), active: true }),
  seeded('logistics-ncr-east-25-40', { zone: 'NCR_EAST', minDistanceKm: 25, maxDistanceKm: 40, baseFee: 2_600, perKmFee: 105, perPieceFee: 0.06, fuelSurchargePercent: 8.5, vehicleType: '14T multi-axle', currency: 'INR', effectiveFrom: date('2026-09-01'), active: true }),
  seeded('logistics-ncr-east-40-60', { zone: 'NCR_EAST', minDistanceKm: 40, maxDistanceKm: 60, baseFee: 3_400, perKmFee: 120, perPieceFee: 0.08, fuelSurchargePercent: 10, vehicleType: '18T multi-axle', currency: 'INR', effectiveFrom: date('2026-09-01'), active: true }),
]

const taxRates = [
  seeded('tax-gst-bricks-5', { code: 'GST_BRICKS_5', name: 'GST on bricks', jurisdiction: 'INTRA_STATE', appliesTo: ['material'], ratePercent: 5, effectiveFrom: date('2026-09-01'), active: true }),
  seeded('tax-igst-bricks-5', { code: 'IGST_BRICKS_5', name: 'IGST on bricks', jurisdiction: 'INTER_STATE', appliesTo: ['material'], ratePercent: 5, effectiveFrom: date('2026-09-01'), active: true }),
  seeded('tax-gst-logistics-18', { code: 'GST_LOGISTICS_18', name: 'GST on logistics', jurisdiction: 'ALL', appliesTo: ['freight', 'handling'], ratePercent: 18, effectiveFrom: date('2026-09-01'), active: true }),
  seeded('tax-gst-platform-18', { code: 'GST_PLATFORM_18', name: 'GST on marketplace fee', jurisdiction: 'ALL', appliesTo: ['platform'], ratePercent: 18, effectiveFrom: date('2026-09-01'), active: true }),
]

const sustainabilityMetrics = [
  seeded('sustainability-arjun-2026-w1', { organizationId: 'org-arjun-construction', orderId: 'NEEV-DEMO-1042', periodStart: date('2026-09-01'), periodEnd: date('2026-09-07'), baselineKg: 18_750, actualKg: 13_750, reducedKg: 5_000, recycledSharePct: 22, methodology: 'kiln fuel and route baseline v1', source: 'supplier_certificate', verified: true }),
  seeded('sustainability-arjun-2026-w2', { organizationId: 'org-arjun-construction', orderId: 'NEEV-DEMO-1042', periodStart: date('2026-09-08'), periodEnd: date('2026-09-14'), baselineKg: 21_000, actualKg: 14_700, reducedKg: 6_300, recycledSharePct: 25, methodology: 'kiln fuel and route baseline v1', source: 'supplier_certificate', verified: true }),
  seeded('sustainability-shakti-2026-w3', { organizationId: 'org-shakti-kiln-works', orderId: 'NEEV-DEMO-1038', periodStart: date('2026-09-15'), periodEnd: date('2026-09-21'), baselineKg: 9_000, actualKg: 6_030, reducedKg: 2_970, recycledSharePct: 31, methodology: 'supplier fuel ledger and recycled clay factor v2', source: 'kiln_ledger', verified: true }),
  seeded('sustainability-narmada-2026-w4', { organizationId: 'org-narmada-brick-depot', orderId: 'NEEV-DEMO-1034', periodStart: date('2026-09-22'), periodEnd: date('2026-09-28'), baselineKg: 6_000, actualKg: 4_380, reducedKg: 1_620, recycledSharePct: 18, methodology: 'route and fuel estimate v1', source: 'estimated', verified: false }),
  seeded('sustainability-yamuna-2026-w4', { organizationId: 'org-yamuna-build-mart', orderId: 'NEEV-DEMO-1029', periodStart: date('2026-09-22'), periodEnd: date('2026-09-28'), baselineKg: 4_500, actualKg: 2_925, reducedKg: 1_575, recycledSharePct: 42, methodology: 'low-carbon product declaration v1', source: 'product_declaration', verified: true }),
]

const mockTestData = [
  seeded('mock-boundary-tier-1000', { category: 'pricing', scenario: 'minimum pricing tier boundary', payload: { quantity: 1_000, unitPrice: 7.62, distanceKm: 11.2 }, expected: { discountPercent: 0, taxRatePercent: 5 }, tags: ['boundary', 'pricing'] }),
  seeded('mock-boundary-tier-50000', { category: 'pricing', scenario: 'highest volume discount boundary', payload: { quantity: 50_000, unitPrice: 6.76, distanceKm: 27.4 }, expected: { discountPercent: 10, tierMinimum: 50_000 }, tags: ['boundary', 'bulk'] }),
  seeded('mock-long-route-logistics', { category: 'logistics', scenario: 'outer NCR route with fuel surcharge', payload: { zone: 'NCR_EAST', distanceKm: 49.5, quantity: 40_000, vehicleType: '18T multi-axle' }, expected: { feeBand: '40-60 km', fuelSurchargePercent: 10 }, tags: ['logistics', 'route-risk'] }),
  seeded('mock-low-carbon-order', { category: 'sustainability', scenario: 'high recycled-share order', payload: { orderId: 'NEEV-DEMO-1038', baselineKg: 9_000, actualKg: 6_030, recycledSharePct: 31 }, expected: { reducedKg: 2_970, verified: true }, tags: ['carbon', 'verified'] }),
  seeded('mock-disputed-delivery', { category: 'order', scenario: 'quality dispute requiring manual review', payload: { orderId: 'NEEV-DEMO-1034', status: 'DISPUTED', quantity: 8_000, site: 'Sector 62, Noida' }, expected: { payout: 'blocked', nextAction: 'operations_review' }, tags: ['exception', 'dispute'] }),
]

async function upsertSeeded(model: mongoose.Model<Record<string, unknown>>, documents: readonly SeedDocument[]) {
  await model.createIndexes()
  await model.bulkWrite(documents.map((document) => ({
    updateOne: {
      filter: { seedKey: document.seedKey, seedVersion: SEED_VERSION },
      update: { $set: document },
      upsert: true,
    },
  })), { ordered: false })
  return documents.length
}

async function main() {
  if (!mongoUri) throw new Error('Set MONGODB_URI or MONGODB_URL before running the seed script')
  await mongoose.connect(mongoUri, { dbName: databaseName, maxPoolSize, serverSelectionTimeoutMS })
  const counts = {
    demoUsers: await upsertSeeded(DemoUser, demoUsers),
    demoVendors: await upsertSeeded(DemoVendor, demoVendors),
    demoProducts: await upsertSeeded(DemoProduct, demoProducts),
    demoInventory: await upsertSeeded(DemoInventory, demoInventory),
    demoOrders: await upsertSeeded(DemoOrder, demoOrders),
    demoQuotes: await upsertSeeded(DemoQuote, demoQuotes),
    pricingTiers: await upsertSeeded(PricingTier, pricingTiers),
    volumeDiscounts: await upsertSeeded(VolumeDiscount, volumeDiscounts),
    logisticsFees: await upsertSeeded(LogisticsFee, logisticsFees),
    taxRates: await upsertSeeded(TaxRate, taxRates),
    sustainabilityMetrics: await upsertSeeded(SustainabilityMetric, sustainabilityMetrics),
    mockTestData: await upsertSeeded(MockTestData, mockTestData),
  }
  await SeedRun.updateOne(
    { seedVersion: SEED_VERSION },
    { $set: { source: 'apps/api/scripts/seed-mongoose.ts', counts, executedAt: new Date() } },
    { upsert: true },
  )
  console.log(`Seeded MongoDB database "${mongoose.connection.name}" with ${Object.values(counts).reduce((total, count) => total + count, 0)} documents for ${SEED_VERSION}`)
  console.log(JSON.stringify(counts))
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message.replace(/mongodb(?:\+srv)?:\/\/[^@]+@/gi, 'mongodb://***@') : 'Unknown MongoDB seed error'
    console.error(`MongoDB seed failed: ${message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
