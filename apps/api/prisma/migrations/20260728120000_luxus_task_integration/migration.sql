ALTER TABLE "requests"
  ADD COLUMN "taskDemandId" TEXT,
  ADD COLUMN "taskProtocol" TEXT,
  ADD COLUMN "taskStatus" TEXT,
  ADD COLUMN "taskResponsibleId" TEXT,
  ADD COLUMN "taskResponsibleName" TEXT,
  ADD COLUMN "taskSyncError" TEXT,
  ADD COLUMN "taskLastSyncAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "requests_taskDemandId_key" ON "requests"("taskDemandId");
CREATE INDEX "requests_taskProtocol_idx" ON "requests"("taskProtocol");
