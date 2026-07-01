-- AlterTable
ALTER TABLE "Product" ADD COLUMN "brandId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "brandId" TEXT;

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "website" TEXT,
    "country" TEXT,
    "supplierType" TEXT NOT NULL DEFAULT 'TRADING',
    "status" TEXT NOT NULL DEFAULT 'PROSPECT',
    "owner" TEXT,
    "nextStep" TEXT,
    "listingFee" REAL,
    "commissionPct" REAL,
    "trialStartDate" DATETIME,
    "aestheticFit" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE INDEX "Brand_status_idx" ON "Brand"("status");

-- CreateIndex
CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");

-- CreateIndex
CREATE INDEX "Task_brandId_idx" ON "Task"("brandId");
