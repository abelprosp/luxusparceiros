CREATE TYPE "SaleContractStage" AS ENUM (
  'PRE_REVIEW', 'TASK_PROCESSING', 'BLANK_CONTRACT_READY_FOR_ADMIN',
  'AWAITING_PARTNER_SIGNATURE', 'SIGNED_CONTRACT_READY_FOR_ADMIN',
  'TASK_VALIDATING_SIGNED_CONTRACT', 'CHANGES_REQUESTED', 'COMPLETED'
);

CREATE TYPE "DocumentPurpose" AS ENUM (
  'GENERAL', 'ORIGINAL_SALE', 'BLANK_CONTRACT', 'SIGNED_CONTRACT'
);

ALTER TABLE "sales"
  ADD COLUMN "contractStage" "SaleContractStage" NOT NULL DEFAULT 'PRE_REVIEW',
  ADD COLUMN "contractStageUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "contractCorrectionReason" TEXT,
  ADD COLUMN "signedContractSyncStatus" "SaleTaskSyncStatus" NOT NULL DEFAULT 'NOT_READY',
  ADD COLUMN "signedContractSyncError" TEXT,
  ADD COLUMN "signedContractSyncAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "signedContractNextRetryAt" TIMESTAMP(3);

ALTER TABLE "documents"
  ADD COLUMN "purpose" "DocumentPurpose" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "externalId" TEXT;

CREATE UNIQUE INDEX "documents_externalId_key" ON "documents"("externalId");
CREATE INDEX "documents_saleId_purpose_idx" ON "documents"("saleId", "purpose");
CREATE INDEX "sales_contractStage_idx" ON "sales"("contractStage");
CREATE INDEX "sales_signedContractSyncStatus_signedContractNextRetryAt_idx"
  ON "sales"("signedContractSyncStatus", "signedContractNextRetryAt");
