-- Target/expected avg RRP per unit (RM) for a brand — used for breakeven
-- units/day before any real sell-through exists. Additive, non-destructive.
ALTER TABLE "Brand" ADD COLUMN "expectedAvgRrp" REAL;
