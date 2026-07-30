ALTER TABLE "requests"
  ADD COLUMN "taskSyncState" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "taskSyncAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "taskNextRetryAt" TIMESTAMP(3),
  ADD COLUMN "taskSyncLockedAt" TIMESTAMP(3);

UPDATE "requests"
SET
  "taskSyncState" = CASE
    WHEN "taskDemandId" IS NOT NULL THEN 'SYNCED'
    WHEN "taskResponsibleId" IS NOT NULL AND "taskSyncError" IS NOT NULL THEN 'RETRY'
    ELSE 'PENDING'
  END,
  "taskNextRetryAt" = CASE
    WHEN "taskDemandId" IS NULL AND "taskResponsibleId" IS NOT NULL THEN NOW()
    ELSE NULL
  END;

ALTER TABLE "request_comments"
  ADD COLUMN "taskSyncedAt" TIMESTAMP(3),
  ADD COLUMN "taskSyncError" TEXT,
  ADD COLUMN "taskSyncAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "taskNextRetryAt" TIMESTAMP(3);

ALTER TABLE "tickets"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "slaNotifiedAt" TIMESTAMP(3);

CREATE INDEX "requests_taskSyncState_taskNextRetryAt_idx"
  ON "requests"("taskSyncState", "taskNextRetryAt");

CREATE INDEX "request_comments_taskNextRetryAt_idx"
  ON "request_comments"("taskNextRetryAt");
