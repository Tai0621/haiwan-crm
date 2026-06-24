-- Membership spine (Phase 2): additive columns on Customer + a memberId lookup
-- index. Hand-authored as ALTER TABLE ADD COLUMN (SQLite-safe, non-destructive)
-- instead of Prisma's default table rebuild, so it applies cleanly to the live
-- Turso database via the HTTP pipeline without dropping/recreating Customer.
ALTER TABLE "Customer" ADD COLUMN "memberStatus" TEXT NOT NULL DEFAULT 'PROSPECT';
ALTER TABLE "Customer" ADD COLUMN "memberId" TEXT;
ALTER TABLE "Customer" ADD COLUMN "joinDate" DATETIME;
ALTER TABLE "Customer" ADD COLUMN "claimedDate" DATETIME;
ALTER TABLE "Customer" ADD COLUMN "pointsBalance" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Customer" ADD COLUMN "posLoyaltyPoints" INTEGER;
CREATE INDEX "Customer_memberId_idx" ON "Customer"("memberId");
