-- CreateTable
CREATE TABLE "AppSetting" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "targetInhousePct" REAL NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
