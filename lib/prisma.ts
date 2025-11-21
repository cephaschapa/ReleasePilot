import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const connectionString = process.env.DATABASE_URL;
const useNeon = connectionString?.startsWith("postgres");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createClient() {
  const logLevel: ("info" | "query" | "warn" | "error")[] =
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"];

  if (useNeon && connectionString) {
    const adapter = new PrismaNeon({ connectionString });

    return new PrismaClient({
      adapter,
      log: logLevel,
    });
  }

  return new PrismaClient({ log: logLevel });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
