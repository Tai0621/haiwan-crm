-- CreateTable
CREATE TABLE "ShiftChecklistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "section" TEXT NOT NULL,
    "sectionOrder" INTEGER NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "shift" TEXT NOT NULL DEFAULT 'BOTH',
    "label" TEXT NOT NULL,
    "note" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'med',
    "storeKL" BOOLEAN NOT NULL DEFAULT true,
    "storePJ" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ShiftChecklistItem_active_idx" ON "ShiftChecklistItem"("active");
