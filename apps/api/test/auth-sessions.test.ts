import { describe, expect, it, vi } from 'vitest'

process.env.DATABASE_URL ??= 'postgresql://neev:neev@localhost:5432/neev?schema=public'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-123456'
process.env.JWT_ISSUER ??= 'neev-api'
process.env.JWT_AUDIENCE ??= 'neev-web'
process.env.PAYMENT_WEBHOOK_SECRET ??= 'test-webhook-secret-123456'
process.env.WEB_ORIGIN ??= 'http://localhost:3000'

const state = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
  updateArgs: null as Record<string, unknown> | null,
  createArgs: null as Record<string, unknown> | null,
}))

// The error middleware imports the Prisma namespace at runtime; stub it here
// so this test does not need a generated Prisma client.
vi.mock('@prisma/client', () => ({
  Prisma: { PrismaClientKnownRequestError: class extends Error {} },
}))

vi.mock('../src/lib/prisma.js', () => {
  const transaction = {
    refreshSession: {
      updateMany: async (args: Record<string, unknown>) => {
        state.updateArgs = args
        return { count: 1 }
      },
      create: async (args: { data: Record<string, unknown> }) => {
        state.createArgs = args
        return { id: args.data.id, userId: args.data.userId }
      },
    },
    auditEvent: {
      create: async () => ({}),
    },
  }
  return {
    prisma: {
      refreshSession: {
        findUnique: async () => state.current,
      },
      $transaction: async (callback: (transaction: unknown) => unknown) => callback(transaction),
    },
  }
})

const { rotateRefreshToken } = await import('../src/lib/auth-sessions.js')

describe('refresh token rotation', () => {
  it('links the old session to the session that was actually created', async () => {
    state.current = {
      id: 'session-old',
      userId: 'user-1',
      familyId: 'family-1',
      tokenHash: 'old-hash',
      usedAt: null,
      revokedAt: null,
      expiresAt: new Date(Date.now() + 3_600_000),
      user: { id: 'user-1', email: 'buyer@neev.demo', name: 'Buyer', roles: ['buyer'], organizationId: 'org-1', isActive: true },
    }

    const rotated = await rotateRefreshToken('any-raw-token', { requestId: 'req-1' })

    const replacedById = (state.updateArgs?.data as Record<string, unknown> | undefined)?.replacedById
    const createdId = (state.createArgs?.data as Record<string, unknown> | undefined)?.id
    expect(replacedById).toBeTruthy()
    expect(createdId).toBe(replacedById)
    expect(rotated.session.id).toBe(replacedById)
  })
})
