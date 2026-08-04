CREATE TYPE "SaleReviewStatus" AS ENUM (
  'DRAFT', 'AWAITING_REVIEW', 'UNDER_REVIEW', 'CHANGES_REQUESTED',
  'APPROVED', 'REJECTED', 'CANCELLED'
);

CREATE TYPE "SaleTaskSyncStatus" AS ENUM (
  'NOT_READY', 'PENDING', 'PROCESSING', 'SYNCED', 'RETRY', 'FAILED'
);

ALTER TABLE "sales"
  ADD COLUMN "reviewStatus" "SaleReviewStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "reviewStartedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "correctionReason" TEXT,
  ADD COLUMN "reviewRevision" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "taskDemandId" TEXT,
  ADD COLUMN "taskProtocol" TEXT,
  ADD COLUMN "taskStatus" TEXT,
  ADD COLUMN "taskResponsibleId" TEXT,
  ADD COLUMN "taskResponsibleName" TEXT,
  ADD COLUMN "taskClientId" TEXT,
  ADD COLUMN "taskClientName" TEXT,
  ADD COLUMN "taskClientDocumentType" TEXT,
  ADD COLUMN "taskClientDocument" TEXT,
  ADD COLUMN "taskDeadline" TIMESTAMP(3),
  ADD COLUMN "taskPriority" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "taskSyncStatus" "SaleTaskSyncStatus" NOT NULL DEFAULT 'NOT_READY',
  ADD COLUMN "taskSyncError" TEXT,
  ADD COLUMN "taskSyncAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "taskNextRetryAt" TIMESTAMP(3),
  ADD COLUMN "taskSyncLockedAt" TIMESTAMP(3),
  ADD COLUMN "taskLastSyncAt" TIMESTAMP(3);

UPDATE "sales"
SET "reviewStatus" = CASE
  WHEN "status" IN ('APPROVED', 'ACTIVATED') THEN 'APPROVED'::"SaleReviewStatus"
  WHEN "status" = 'REJECTED' THEN 'REJECTED'::"SaleReviewStatus"
  WHEN "status" = 'CANCELLED' THEN 'CANCELLED'::"SaleReviewStatus"
  ELSE 'AWAITING_REVIEW'::"SaleReviewStatus"
END,
"submittedAt" = "createdAt";

CREATE TABLE "sale_timeline" (
  "id" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "actorId" TEXT,
  "actorName" TEXT,
  "action" TEXT NOT NULL,
  "fromReviewStatus" "SaleReviewStatus",
  "toReviewStatus" "SaleReviewStatus",
  "details" TEXT,
  "changes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sale_timeline_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sale_timeline_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "sales_reviewStatus_idx" ON "sales"("reviewStatus");
CREATE INDEX "sales_taskSyncStatus_taskNextRetryAt_idx" ON "sales"("taskSyncStatus", "taskNextRetryAt");
CREATE INDEX "sale_timeline_saleId_createdAt_idx" ON "sale_timeline"("saleId", "createdAt");
