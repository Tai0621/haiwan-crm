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

// Turso (and any remote libsql:// / https:// database) requires an auth token.
// Local file: URLs don't. Support either of the conventional env var names.
const authToken =
  process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined;
const isRemote = !dbUrl.startsWith("file:");

function makeClient() {
  const adapter = new PrismaLibSql(
    isRemote && authToken ? { url: dbUrl, authToken } : { url: dbUrl },
  );
  return new PrismaClient({ adapter });
}

// Reuse a single instance across hot-reloads (dev) and warm serverless
// invocations (prod) — creating a client per request exhausts connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? makeClient();
globalForPrisma.prisma = prisma;
