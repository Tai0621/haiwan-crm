-- AlterTable
ALTER TABLE "Product" ADD COLUMN "wixProductId" TEXT;
ALTER TABLE "Product" ADD COLUMN "wixStock" INTEGER;
ALTER TABLE "Product" ADD COLUMN "wixSyncedAt" DATETIME;

-- CreateIndex
CREATE UNIQUE INDEX "Product_wixProductId_key" ON "Product"("wixProductId");
