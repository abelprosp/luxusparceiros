-- CreateEnum
CREATE TYPE "CommissionType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "BranchStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterEnum
ALTER TYPE "SaleStatus" ADD VALUE 'CONTESTED';
ALTER TYPE "SaleStatus" ADD VALUE 'DOCUMENTS_PENDING';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SALE_REJECTED';
ALTER TYPE "NotificationType" ADD VALUE 'SALE_CONTESTED';
ALTER TYPE "NotificationType" ADD VALUE 'DOCUMENTS_REQUESTED';

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "BranchStatus" NOT NULL DEFAULT 'ACTIVE',
    "parentPartnerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_plans" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "customCommission" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partner_plans_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "plans" ADD COLUMN "commissionType" "CommissionType" NOT NULL DEFAULT 'PERCENTAGE';
ALTER TABLE "plans" ADD COLUMN "commissionValue" DECIMAL(10,2);

-- Backfill commissionValue from commission
UPDATE "plans" SET "commissionValue" = "commission" WHERE "commissionValue" IS NULL;
ALTER TABLE "plans" ALTER COLUMN "commissionValue" SET NOT NULL;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "branchId" TEXT;
ALTER TABLE "sales" ADD COLUMN "campaignId" TEXT;
ALTER TABLE "sales" ADD COLUMN "contestReason" TEXT;
ALTER TABLE "sales" ADD COLUMN "requiredDocuments" JSONB;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN "branchId" TEXT;

-- AlterTable
ALTER TABLE "requests" ADD COLUMN "branchId" TEXT;

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN "branchId" TEXT;

-- CreateIndex
CREATE INDEX "branches_parentPartnerId_idx" ON "branches"("parentPartnerId");
CREATE INDEX "branches_document_idx" ON "branches"("document");
CREATE INDEX "branches_status_idx" ON "branches"("status");

CREATE UNIQUE INDEX "partner_plans_partnerId_planId_key" ON "partner_plans"("partnerId", "planId");
CREATE INDEX "partner_plans_partnerId_idx" ON "partner_plans"("partnerId");
CREATE INDEX "partner_plans_planId_idx" ON "partner_plans"("planId");

CREATE INDEX "sales_branchId_idx" ON "sales"("branchId");
CREATE INDEX "sales_campaignId_idx" ON "sales"("campaignId");
CREATE INDEX "clients_branchId_idx" ON "clients"("branchId");
CREATE INDEX "requests_branchId_idx" ON "requests"("branchId");
CREATE INDEX "stock_movements_branchId_idx" ON "stock_movements"("branchId");

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_parentPartnerId_fkey" FOREIGN KEY ("parentPartnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "partner_plans" ADD CONSTRAINT "partner_plans_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "partner_plans" ADD CONSTRAINT "partner_plans_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "clients" ADD CONSTRAINT "clients_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "sales" ADD CONSTRAINT "sales_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requests" ADD CONSTRAINT "requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
