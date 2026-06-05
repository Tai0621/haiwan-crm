-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "phone" TEXT NOT NULL,
    "rawPhone" TEXT,
    "contactName" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'INBOUND',
    "body" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "externalId" TEXT,
    "analyzedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WhatsAppMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WhatsAppLead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "phone" TEXT NOT NULL,
    "contactName" TEXT,
    "type" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "itemsJson" TEXT,
    "evidence" TEXT,
    "confidence" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "analysisDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" DATETIME,
    CONSTRAINT "WhatsAppLead_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_externalId_key" ON "WhatsAppMessage"("externalId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_phone_idx" ON "WhatsAppMessage"("phone");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_timestamp_idx" ON "WhatsAppMessage"("timestamp");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_customerId_idx" ON "WhatsAppMessage"("customerId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_analyzedAt_idx" ON "WhatsAppMessage"("analyzedAt");

-- CreateIndex
CREATE INDEX "WhatsAppLead_status_idx" ON "WhatsAppLead"("status");

-- CreateIndex
CREATE INDEX "WhatsAppLead_analysisDate_idx" ON "WhatsAppLead"("analysisDate");

-- CreateIndex
CREATE INDEX "WhatsAppLead_customerId_idx" ON "WhatsAppLead"("customerId");
