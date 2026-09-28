import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createHmac } from 'node:crypto'
import jwt from 'jsonwebtoken'

process.env.DATABASE_URL ??= 'postgresql://neev:neev@localhost:5432/neev?schema=public'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-123456'
process.env.PAYMENT_WEBHOOK_SECRET ??= 'test-webhook-secret-123456'
process.env.WEB_ORIGIN ??= 'http://localhost:3000'

const buyerToken = () => jwt.sign({ sub: 'user_demo', organizationId: 'org_demo', roles: ['buyer'] }, process.env.JWT_SECRET!)
const supplierOpsToken = () => jwt.sign({ sub: 'ops_demo', organizationId: 'org_demo', roles: ['supplier_ops'] }, process.env.JWT_SECRET!)

describe('API contract', () => {
  it('returns a liveness response without external services', async () => {
    const { createApp } = await import('../src/app.js')
    const response = await request(createApp()).get('/api/v1/health/live')
    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({ status: 'ok', service: 'neev-api' })
  })

  it('returns structured 404 errors with a request id', async () => {
    const { createApp } = await import('../src/app.js')
    const response = await request(createApp()).get('/missing')
    expect(response.status).toBe(404)
    expect(response.body.requestId).toEqual(expect.any(String))
  })

  it('requires authentication before creating a quote request or payment intent', async () => {
    const { createApp } = await import('../src/app.js')
    const app = createApp()
    const quoteResponse = await request(app).post('/api/v1/quote-requests').send({ quantity: 25000, deliveryArea: 'Noida' })
    const paymentResponse = await request(app).post('/api/v1/payment-intents').send({ orderId: 'order_demo', gateway: 'stripe' })
    expect(quoteResponse.status).toBe(401)
    expect(paymentResponse.status).toBe(401)
  })

  it('accepts only a valid HMAC payment webhook signature', async () => {
    const { createApp } = await import('../src/app.js')
    const body = JSON.stringify({ id: 'evt_demo', type: 'payment.captured' })
    const signature = createHmac('sha256', process.env.PAYMENT_WEBHOOK_SECRET!).update(body).digest('hex')
    const app = createApp()
    const invalid = await request(app).post('/api/v1/payments/stripe/webhook').set('Content-Type', 'application/json').set('x-gateway-signature', 'invalid').send(body)
    const valid = await request(app).post('/api/v1/payments/stripe/webhook').set('Content-Type', 'application/json').set('x-gateway-signature', signature).send(body)
    expect(invalid.status).toBe(401)
    expect(valid.status).toBe(202)
    expect(valid.body).toMatchObject({ accepted: true, gateway: 'stripe' })
  })

  it('calculates volume discounts and dynamic fees for an authenticated buyer', async () => {
    const { createApp } = await import('../src/app.js')
    const response = await request(createApp())
      .post('/api/v1/pricing/calculate')
      .set('Authorization', `Bearer ${buyerToken()}`)
      .send({ quantity: 25000, unitPrice: 7.2, distanceKm: 38 })
    expect(response.status).toBe(200)
    expect(response.body.data.discount).toMatchObject({ tierMinimum: 25000, rateBps: 700, amount: '12600.00' })
    expect(response.body.data.fees).toHaveLength(6)
    expect(response.body.data.totals.total).toEqual(expect.any(String))
  })

  it('validates sustainability measurements before touching the database', async () => {
    const { createApp } = await import('../src/app.js')
    const response = await request(createApp())
      .post('/api/v1/sustainability/metrics')
      .set('Authorization', `Bearer ${supplierOpsToken()}`)
      .send({
        periodStart: '2026-01-01T00:00:00.000Z',
        periodEnd: '2026-02-01T00:00:00.000Z',
        baselineKg: 100,
        actualKg: 110,
        recycledSharePct: 20,
        methodology: 'verified baseline',
      })
    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Validation failed')
  })

  it('serves the OpenAPI document and rejects oversized JSON bodies', async () => {
    const { createApp } = await import('../src/app.js')
    const app = createApp()
    const docs = await request(app).get('/api/v1/docs/openapi.json')
    const oversized = await request(app)
      .post('/api/v1/pricing/calculate')
      .set('Authorization', `Bearer ${buyerToken()}`)
      .send({ quantity: 1000, unitPrice: 7, oversized: 'x'.repeat(70 * 1024) })
    expect(docs.status).toBe(200)
    expect(docs.body.paths['/pricing/calculate']).toBeTruthy()
    expect(oversized.status).toBe(413)
  })

  it('rejects oversized multipart payloads before a file parser can run', async () => {
    const { createApp } = await import('../src/app.js')
    const response = await request(createApp())
      .post('/api/v1/pricing/calculate')
      .set('Content-Type', 'multipart/form-data; boundary=neev')
      .set('Content-Length', String(5 * 1024 * 1024 + 1))
      .send('x')
    expect(response.status).toBe(413)
  })
})
