import { describe, expect, it } from 'vitest'
import jwt from 'jsonwebtoken'

process.env.DATABASE_URL ??= 'postgresql://neev:neev@localhost:5432/neev?schema=public'
process.env.REDIS_URL ??= 'redis://localhost:6379'
process.env.JWT_SECRET ??= 'test-secret-that-is-long-enough-123456'
process.env.JWT_ISSUER ??= 'neev-api'
process.env.JWT_AUDIENCE ??= 'neev-web'
process.env.PAYMENT_WEBHOOK_SECRET ??= 'test-webhook-secret-123456'
process.env.WEB_ORIGIN ??= 'http://localhost:3000'

const { signAccessToken, userMatchesAccessToken, verifyAccessToken } = await import('../src/middleware/auth.js')

const validToken = () => signAccessToken({ userId: 'user-1', organizationId: 'org-1', roles: ['buyer'] })
const signed = (payload: Record<string, unknown>, options: jwt.SignOptions = {}) => jwt.sign(payload, process.env.JWT_SECRET!, {
  algorithm: 'HS256',
  issuer: process.env.JWT_ISSUER,
  audience: process.env.JWT_AUDIENCE,
  expiresIn: '15m',
  jwtid: 'test-jti',
  ...options,
})

describe('JWT access tokens', () => {
  it('accepts a complete short-lived access token', () => {
    expect(verifyAccessToken(validToken())).toMatchObject({ sub: 'user-1', organizationId: 'org-1', roles: ['buyer'], tokenType: 'access', jti: expect.any(String) })
  })

  it('rejects a blank token', () => {
    expect(() => verifyAccessToken('')).toThrow('Invalid access token')
  })

  it('rejects a token signed with another secret', () => {
    const token = jwt.sign({ sub: 'user-1', organizationId: 'org-1', roles: ['buyer'], tokenType: 'access' }, 'another-secret-that-is-long-enough-123456', { algorithm: 'HS256', issuer: process.env.JWT_ISSUER, audience: process.env.JWT_AUDIENCE, expiresIn: '15m' })
    expect(() => verifyAccessToken(token)).toThrow('Invalid access token')
  })

  it('rejects an algorithm outside the allowlist', () => {
    const token = signed({ sub: 'user-1', organizationId: 'org-1', roles: ['buyer'], tokenType: 'access' }, { algorithm: 'HS384' })
    expect(() => verifyAccessToken(token)).toThrow('Invalid access token')
  })

  it('rejects the wrong issuer', () => {
    const token = signed({ sub: 'user-1', organizationId: 'org-1', roles: ['buyer'], tokenType: 'access' }, { issuer: 'other-api' })
    expect(() => verifyAccessToken(token)).toThrow('Invalid access token')
  })

  it('rejects the wrong audience', () => {
    const token = signed({ sub: 'user-1', organizationId: 'org-1', roles: ['buyer'], tokenType: 'access' }, { audience: 'other-client' })
    expect(() => verifyAccessToken(token)).toThrow('Invalid access token')
  })

  it('rejects an expired token', () => {
    const token = signed({ sub: 'user-1', organizationId: 'org-1', roles: ['buyer'], tokenType: 'access' }, { expiresIn: -10 })
    expect(() => verifyAccessToken(token)).toThrow('Invalid access token')
  })

  it.each([
    ['missing subject', { organizationId: 'org-1', roles: ['buyer'], tokenType: 'access' }],
    ['missing organization', { sub: 'user-1', roles: ['buyer'], tokenType: 'access' }],
    ['missing roles', { sub: 'user-1', organizationId: 'org-1', tokenType: 'access' }],
    ['missing token type', { sub: 'user-1', organizationId: 'org-1', roles: ['buyer'] }],
    ['unknown role', { sub: 'user-1', organizationId: 'org-1', roles: ['root'], tokenType: 'access' }],
    ['duplicate role', { sub: 'user-1', organizationId: 'org-1', roles: ['buyer', 'buyer'], tokenType: 'access' }],
  ])('rejects %s claims', (_name, payload) => {
    expect(() => verifyAccessToken(signed(payload))).toThrow('Invalid access token')
  })
})

describe('database-backed token authorization', () => {
  const claims = verifyAccessToken(validToken())

  it('accepts an active user with the same organization and roles', () => {
    expect(userMatchesAccessToken(claims, { id: 'user-1', organizationId: 'org-1', roles: ['buyer'], isActive: true })).toBe(true)
  })

  it.each([
    ['a different user', { id: 'user-2', organizationId: 'org-1', roles: ['buyer'], isActive: true }],
    ['a different organization', { id: 'user-1', organizationId: 'org-2', roles: ['buyer'], isActive: true }],
    ['an inactive user', { id: 'user-1', organizationId: 'org-1', roles: ['buyer'], isActive: false }],
    ['a user with fewer roles', { id: 'user-1', organizationId: 'org-1', roles: [], isActive: true }],
    ['a user with a changed role', { id: 'user-1', organizationId: 'org-1', roles: ['supplier'], isActive: true }],
  ])('rejects %s', (_name, user) => {
    expect(userMatchesAccessToken(claims, user)).toBe(false)
  })
})
