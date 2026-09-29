import type { Role } from '@prisma/client'

export const permissionValues = [
  'quote_requests:create',
  'quotes:accept:buyer',
  'quotes:accept:supplier',
  'payment_intents:create',
  'pricing:calculate',
  'sustainability:read',
  'sustainability:write',
  'inventory:update',
  'dispatch:schedule',
  'dispatch:proof',
  'timeline:read',
] as const

export type Permission = typeof permissionValues[number]

export const rolePermissions: Record<Role, readonly Permission[]> = {
  buyer: ['quote_requests:create', 'quotes:accept:buyer', 'pricing:calculate', 'sustainability:read', 'timeline:read'],
  buyer_finance: ['quote_requests:create', 'quotes:accept:buyer', 'payment_intents:create', 'pricing:calculate', 'sustainability:read', 'timeline:read'],
  supplier: ['quotes:accept:supplier', 'pricing:calculate', 'inventory:update', 'sustainability:read', 'timeline:read'],
  supplier_ops: ['pricing:calculate', 'sustainability:read', 'sustainability:write', 'inventory:update', 'dispatch:schedule', 'dispatch:proof', 'timeline:read'],
  ops_admin: permissionValues,
}

export function hasPermission(roles: Role[], permission: Permission) {
  return roles.some((role) => rolePermissions[role]?.includes(permission))
}

export function hasAnyPermission(roles: Role[], permissions: Permission[]) {
  return permissions.some((permission) => hasPermission(roles, permission))
}
