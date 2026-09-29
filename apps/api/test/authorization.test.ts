import { describe, expect, it } from 'vitest'
import { hasAnyPermission, hasPermission, rolePermissions, type Permission } from '../src/lib/authorization.js'

const cases: Array<[string, string[], Permission, boolean]> = [
  ['buyer creates quote requests', ['buyer'], 'quote_requests:create', true],
  ['buyer cannot create payments', ['buyer'], 'payment_intents:create', false],
  ['buyer finance creates payments', ['buyer_finance'], 'payment_intents:create', true],
  ['buyer finance accepts buyer quotes', ['buyer_finance'], 'quotes:accept:buyer', true],
  ['supplier accepts supplier quotes', ['supplier'], 'quotes:accept:supplier', true],
  ['supplier cannot accept buyer quotes', ['supplier'], 'quotes:accept:buyer', false],
  ['supplier updates inventory', ['supplier'], 'inventory:update', true],
  ['supplier ops schedules dispatch', ['supplier_ops'], 'dispatch:schedule', true],
  ['supplier ops marks dispatch in transit', ['supplier_ops'], 'dispatch:transit', true],
  ['supplier ops records proof', ['supplier_ops'], 'dispatch:proof', true],
  ['supplier cannot create payments', ['supplier'], 'payment_intents:create', false],
  ['ops can create payments', ['ops_admin'], 'payment_intents:create', true],
  ['ops can write sustainability', ['ops_admin'], 'sustainability:write', true],
  ['buyer can read sustainability', ['buyer'], 'sustainability:read', true],
  ['buyer cannot write sustainability', ['buyer'], 'sustainability:write', false],
  ['all roles can calculate pricing where intended', ['supplier_ops'], 'pricing:calculate', true],
  ['all order participants can read timelines', ['supplier'], 'timeline:read', true],
  ['all marketplace roles can read catalog', ['buyer'], 'catalog:read', true],
  ['unknown roles have no permissions', ['unknown'], 'timeline:read', false],
]

describe('RBAC permission matrix', () => {
  it.each(cases)('checks %s', (_name, roles, permission, expected) => {
    expect(hasPermission(roles as never[], permission)).toBe(expected)
  })

  it('allows any matching permission for a multi-role user', () => {
    expect(hasAnyPermission(['buyer', 'buyer_finance'], ['dispatch:schedule', 'payment_intents:create'])).toBe(true)
  })

  it('denies when no permission matches', () => {
    expect(hasAnyPermission(['buyer', 'supplier'], ['dispatch:schedule', 'payment_intents:create'])).toBe(false)
  })

  it('gives ops administrators the complete permission set', () => {
    expect(rolePermissions.ops_admin).toHaveLength(13)
  })

  it('does not grant permissions to an empty role list', () => {
    expect(hasPermission([], 'pricing:calculate')).toBe(false)
  })
})
