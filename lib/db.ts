// Shared Prisma client singleton for the Next.js app.
// Uses @libsql/client + @prisma/adapter-libsql (required by Prisma 7).
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../app/generated/prisma/client";
import path from "path";

const dbUrl =
  process.env.DATABASE_URL
    ? process.env.DATABASE_URL.startsWith("file:")
      ? `file:${path.resolve(process.cwd(), process.env.DATABASE_URL.replace(/^file:/, ""))}`
      : process.env.DATABASE_URL
    : `file:${path.resolve(process.cwd(), "../data/haiwan.db")}`;

function makeClient() {
  const adapter = new PrismaLibSql({ url: dbUrl });
  return new PrismaClient({ adapter });
}

// Reuse single instance in development (Next.js hot-reload creates new modules)
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? makeClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
