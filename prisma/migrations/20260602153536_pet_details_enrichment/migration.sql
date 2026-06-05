-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Pet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "breed" TEXT,
    "sex" TEXT,
    "neutered" BOOLEAN NOT NULL DEFAULT false,
    "dateOfBirth" DATETIME,
    "approxAgeMonths" INTEGER,
    "adoptionDate" DATETIME,
    "weightKg" REAL,
    "lifeStage" TEXT,
    "colorMarkings" TEXT,
    "microchipId" TEXT,
    "vetName" TEXT,
    "dietaryNotes" TEXT,
    "allergies" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pet_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Pet" ("allergies", "approxAgeMonths", "breed", "createdAt", "customerId", "dateOfBirth", "dietaryNotes", "id", "lifeStage", "name", "species", "updatedAt", "weightKg") SELECT "allergies", "approxAgeMonths", "breed", "createdAt", "customerId", "dateOfBirth", "dietaryNotes", "id", "lifeStage", "name", "species", "updatedAt", "weightKg" FROM "Pet";
DROP TABLE "Pet";
ALTER TABLE "new_Pet" RENAME TO "Pet";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
