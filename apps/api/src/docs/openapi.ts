export const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Neev Marketplace API',
    version: '1.0.0',
    description: 'Authenticated APIs for bulk brick pricing, sustainability tracking, inventory, orders, and dispatch.',
  },
  servers: [{ url: '/api/v1' }],
  tags: [
    { name: 'Auth', description: 'Password login and rotating refresh sessions' },
    { name: 'Pricing', description: 'Volume pricing and dynamic fee calculation' },
    { name: 'Sustainability', description: 'Organization-scoped carbon reduction metrics' },
    { name: 'Assistant', description: 'Rate-limited server-side Gemini supply guidance' },
    { name: 'Health', description: 'Service and dependency health' },
  ],
  paths: {
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Create an access token and refresh session',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginRequest' } } },
        },
        responses: {
          '200': { description: 'Access token issued; refresh token set in an HttpOnly cookie.', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '400': { $ref: '#/components/responses/ValidationError' },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate the refresh session and issue a new access token',
        security: [{ refreshCookie: [] }],
        responses: {
          '200': { description: 'Access token issued and refresh cookie rotated.', content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthResponse' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke the refresh-token family',
        security: [{ refreshCookie: [] }],
        responses: { '204': { description: 'Refresh session revoked.' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Read the authenticated user',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Authenticated user.' }, '401': { $ref: '#/components/responses/Unauthorized' } },
      },
    },
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
    '/assistant/chat': {
      post: {
        tags: ['Assistant'],
        summary: 'Ask the public Neev supply assistant',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AssistantChatRequest' } } },
        },
        responses: {
          '200': { description: 'Assistant response.', content: { 'application/json': { schema: { $ref: '#/components/schemas/AssistantChatResponse' } } } },
          '400': { $ref: '#/components/responses/ValidationError' },
          '429': { description: 'Assistant rate limit exceeded.' },
          '502': { description: 'Assistant provider unavailable.' },
          '503': { description: 'Assistant is not configured.' },
        },
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
      refreshCookie: { type: 'apiKey', in: 'cookie', name: 'neev_refresh' },
    },
    schemas: {
      LoginRequest: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 320 },
          password: { type: 'string', minLength: 12, maxLength: 128 },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          data: {
            type: 'object',
            properties: {
              accessToken: { type: 'string' },
              tokenType: { type: 'string', enum: ['Bearer'] },
              expiresIn: { type: 'integer' },
              user: { $ref: '#/components/schemas/User' },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          email: { type: 'string', format: 'email' },
          name: { type: 'string' },
          roles: { type: 'array', items: { type: 'string' } },
          organizationId: { type: 'string' },
        },
      },
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
      AssistantChatRequest: {
        type: 'object',
        required: ['message'],
        properties: { message: { type: 'string', minLength: 1, maxLength: 1500 } },
      },
      AssistantChatResponse: {
        type: 'object',
        properties: { data: { type: 'object', properties: { text: { type: 'string' } } } },
      },
    },
    responses: {
      Unauthorized: { description: 'A valid JWT bearer token is required.' },
      Forbidden: { description: 'The token does not contain an allowed role or organization scope.' },
      ValidationError: { description: 'The request body or query failed validation.' },
    },
  },
} as const
