import type { Prisma } from '@prisma/client'

type AuditWriter = Pick<Prisma.TransactionClient, 'auditEvent'>

export type AuditInput = {
  organizationId?: string
  orderId?: string
  actorId: string
  actorType?: string
  action: string
  entityType: string
  entityId?: string
  requestId: string
  before?: Prisma.InputJsonValue
  after?: Prisma.InputJsonValue
  payload?: Prisma.InputJsonValue
}

export function recordAudit(writer: AuditWriter, input: AuditInput) {
  return writer.auditEvent.create({
    data: {
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.orderId ? { orderId: input.orderId } : {}),
      actorId: input.actorId,
      actorType: input.actorType ?? 'user',
      action: input.action,
      entityType: input.entityType,
      ...(input.entityId ? { entityId: input.entityId } : {}),
      requestId: input.requestId,
      ...(input.before !== undefined ? { before: input.before } : {}),
      ...(input.after !== undefined ? { after: input.after } : {}),
      payload: input.payload ?? {},
    },
  })
}
