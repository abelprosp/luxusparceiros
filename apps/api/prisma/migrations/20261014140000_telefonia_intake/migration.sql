ALTER TABLE "sales" ADD COLUMN "telefoniaSyncStatus" "SaleTaskSyncStatus" NOT NULL DEFAULT 'NOT_READY';
ALTER TABLE "sales" ADD COLUMN "telefoniaSyncError" TEXT;
ALTER TABLE "sales" ADD COLUMN "telefoniaSyncAttempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "sales" ADD COLUMN "telefoniaNextRetryAt" TIMESTAMP(3);
ALTER TABLE "sales" ADD COLUMN "telefoniaLastSyncAt" TIMESTAMP(3);
ALTER TABLE "sales" ADD COLUMN "telefoniaCustomerId" TEXT;

CREATE INDEX "sales_telefoniaSyncStatus_telefoniaNextRetryAt_idx" ON "sales"("telefoniaSyncStatus", "telefoniaNextRetryAt");
