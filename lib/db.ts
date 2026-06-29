import { PrismaNeon } from '@prisma/adapter-neon'
import { PrismaClient } from '@/lib/generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL!
  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({ adapter } as any)
}

// Lazy getter — Prisma client is only created on first access, not on import
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    if (!globalForPrisma.prisma) {
      globalForPrisma.prisma = createPrismaClient()
    }
    return Reflect.get(globalForPrisma.prisma, prop, receiver)
  },
})
