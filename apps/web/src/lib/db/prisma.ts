import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  farashaPrisma?: PrismaClient;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set before database access.");
  }

  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getPrismaClient() {
  globalForPrisma.farashaPrisma ??= createPrismaClient();
  return globalForPrisma.farashaPrisma;
}

// Auth.js and statically built server routes can import the adapter before a
// request needs PostgreSQL. Resolve the connection lazily on first database use.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = getPrismaClient();
    return Reflect.get(client, property, client);
  },
});
