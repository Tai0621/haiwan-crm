-- CreateTable
CREATE TABLE "ShiftLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shift" TEXT NOT NULL,
    "store" TEXT NOT NULL DEFAULT 'NONE',
    "businessDate" DATETIME NOT NULL,
    "staffName" TEXT NOT NULL,
    "itemsTotal" INTEGER NOT NULL,
    "itemsDone" INTEGER NOT NULL,
    "checkedItems" TEXT,
    "remarks" TEXT,
    "supervisorName" TEXT,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "ShiftLog_businessDate_idx" ON "ShiftLog"("businessDate");

-- CreateIndex
CREATE INDEX "ShiftLog_shift_idx" ON "ShiftLog"("shift");
