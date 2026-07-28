ALTER TABLE "requests"
  ADD COLUMN "taskClientId" TEXT,
  ADD COLUMN "taskClientName" TEXT,
  ADD COLUMN "taskDeadline" TEXT,
  ADD COLUMN "taskPriority" BOOLEAN NOT NULL DEFAULT false;
