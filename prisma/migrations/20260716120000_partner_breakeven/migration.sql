-- Partner breakeven (vendor viability KPI). Additive ADD COLUMNs only, so this
-- applies safely to the live Brand/AppSetting tables (no destructive rebuild).
ALTER TABLE "Brand" ADD COLUMN "feeCurrency" TEXT DEFAULT 'MYR';
ALTER TABLE "Brand" ADD COLUMN "listingFeeMonthly" REAL;
ALTER TABLE "Brand" ADD COLUMN "adSpendMonthly" REAL;
ALTER TABLE "Brand" ADD COLUMN "vendorMarkup" REAL;

ALTER TABLE "AppSetting" ADD COLUMN "fxUsdMyr" REAL NOT NULL DEFAULT 4.08;
ALTER TABLE "AppSetting" ADD COLUMN "fxSgdMyr" REAL NOT NULL DEFAULT 3.16;
ALTER TABLE "AppSetting" ADD COLUMN "defaultVendorMarkup" REAL NOT NULL DEFAULT 3;
