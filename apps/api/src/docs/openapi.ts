export const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Neev Marketplace API',
    version: '1.0.0',
    description: 'Authenticated APIs for bulk brick pricing, sustainability tracking, inventory, orders, and dispatch.',
  },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'Pricing', description: 'Volume pricing and dynamic fee calculation' },
    { name: 'Sustainability', description: 'Organization-scoped carbon reduction metrics' },
    { name: 'Health', description: 'Service and dependency health' },
  ],
  paths: {
    '/pricing/calculate': {
      post: {
        tags: ['Pricing'],
        summary: 'Calculate bulk order pricing',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PricingCalculateRequest' } } },
        },
        responses: {
          '200': { description: 'Calculated discount, fee breakdown, and total.' },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/sustainability/metrics': {
      get: {
        tags: ['Sustainability'],
        summary: 'Read organization carbon reduction metrics',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: { '200': { description: 'Aggregated totals and period trend.' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
      post: {
        tags: ['Sustainability'],
        summary: 'Record a carbon measurement period',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SustainabilityMetricRequest' } } },
        },
        responses: { '201': { description: 'Stored or updated metric.' }, '400': { $ref: '#/components/responses/ValidationError' }, '403': { $ref: '#/components/responses/Forbidden' } },
      },
    },
    '/health/live': {
      get: { tags: ['Health'], summary: 'Check process liveness', responses: { '200': { description: 'Process is alive.' } } },
    },
    '/health/ready': {
      get: { tags: ['Health'], summary: 'Check database and Redis readiness', responses: { '200': { description: 'Dependencies are ready.' }, '503': { description: 'A dependency is unavailable.' } } },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      PricingCalculateRequest: {
        type: 'object',
        required: ['quantity', 'unitPrice'],
        properties: {
          quantity: { type: 'integer', minimum: 1000, maximum: 5000000, example: 25000 },
          unitPrice: { type: 'number', minimum: 0, example: 7.2 },
          distanceKm: { type: 'number', minimum: 0, maximum: 5000, default: 0, example: 38 },
          carbonKgPerPiece: { type: 'number', minimum: 0, maximum: 10, example: 0.55 },
          includeCarbonContribution: { type: 'boolean', default: true },
          currency: { type: 'string', enum: ['INR'], default: 'INR' },
        },
      },
      SustainabilityMetricRequest: {
        type: 'object',
        required: ['periodStart', 'periodEnd', 'baselineKg', 'actualKg', 'recycledSharePct', 'methodology'],
        properties: {
          periodStart: { type: 'string', format: 'date-time' },
          periodEnd: { type: 'string', format: 'date-time' },
          baselineKg: { type: 'number', minimum: 0 },
          actualKg: { type: 'number', minimum: 0 },
          recycledSharePct: { type: 'number', minimum: 0, maximum: 100 },
          methodology: { type: 'string', maxLength: 120 },
          orderId: { type: 'string' },
        },
      },
    },
    responses: {
      Unauthorized: { description: 'A valid JWT bearer token is required.' },
      Forbidden: { description: 'The token does not contain an allowed role or organization scope.' },
      ValidationError: { description: 'The request body or query failed validation.' },
    },
  },
} as const
