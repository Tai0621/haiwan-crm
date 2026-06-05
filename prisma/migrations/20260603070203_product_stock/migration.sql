-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "category" TEXT NOT NULL,
    "targetSpecies" TEXT NOT NULL DEFAULT 'ANY',
    "lifeStage" TEXT NOT NULL DEFAULT 'ANY',
    "packSize" REAL,
    "packUnit" TEXT,
    "supplierType" TEXT NOT NULL DEFAULT 'TRADING',
    "costPrice" REAL,
    "retailPrice" REAL,
    "isConsumable" BOOLEAN NOT NULL DEFAULT false,
    "stockKL" INTEGER NOT NULL DEFAULT 0,
    "stockPJ" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Product" ("brand", "category", "costPrice", "createdAt", "id", "isConsumable", "lifeStage", "name", "packSize", "packUnit", "retailPrice", "sku", "supplierType", "targetSpecies", "updatedAt") SELECT "brand", "category", "costPrice", "createdAt", "id", "isConsumable", "lifeStage", "name", "packSize", "packUnit", "retailPrice", "sku", "supplierType", "targetSpecies", "updatedAt" FROM "Product";
DROP TABLE "Product";
ALTER TABLE "new_Product" RENAME TO "Product";
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
