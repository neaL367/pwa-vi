import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not defined");

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
