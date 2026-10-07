ALTER TABLE "sales" ADD COLUMN "isUpgrade" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sales" ADD COLUMN "upgradeOfSaleId" TEXT;

CREATE INDEX "sales_upgradeOfSaleId_idx" ON "sales"("upgradeOfSaleId");

ALTER TABLE "sales"
  ADD CONSTRAINT "sales_upgradeOfSaleId_fkey"
  FOREIGN KEY ("upgradeOfSaleId") REFERENCES "sales"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
