-- CreateTable
CREATE TABLE "StockDiscrepancy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stockUpdateId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "expected" INTEGER NOT NULL,
    "received" INTEGER NOT NULL,
    "note" TEXT,
    "checkedBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "StockDiscrepancy_createdAt_idx" ON "StockDiscrepancy"("createdAt");

-- AlterTable (hand-authored additive columns for the receive & check flow)
ALTER TABLE "StockUpdate" ADD COLUMN "verifiedBy" TEXT;
ALTER TABLE "StockUpdate" ADD COLUMN "verifiedAt" DATETIME;
