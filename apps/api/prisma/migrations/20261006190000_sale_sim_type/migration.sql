-- CreateEnum
CREATE TYPE "SaleSimType" AS ENUM ('CHIP', 'ESIM');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "simType" "SaleSimType" NOT NULL DEFAULT 'CHIP';
