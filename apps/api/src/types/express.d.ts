import type { Role } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      id: string
      auth?: {
        userId: string
        organizationId: string
        roles: Role[]
      }
    }
  }
}

export {}
