-- AlterTable
ALTER TABLE "users" ADD COLUMN "branchId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_branchId_key" ON "users"("branchId");

-- CreateIndex
CREATE INDEX "users_branchId_idx" ON "users"("branchId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
