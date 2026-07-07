-- CreateEnum
CREATE TYPE "ContractFormat" AS ENUM ('PRINT', 'ZAPSIGN');

-- AlterEnum
ALTER TYPE "DocumentType" ADD VALUE 'LINE_PHOTO';
ALTER TYPE "DocumentType" ADD VALUE 'CHIP_PHOTO';

-- AlterTable clients
ALTER TABLE "clients" ADD COLUMN "rg" TEXT;
ALTER TABLE "clients" ADD COLUMN "addressNumber" TEXT;
ALTER TABLE "clients" ADD COLUMN "complement" TEXT;
ALTER TABLE "clients" ADD COLUMN "neighborhood" TEXT;

-- AlterTable sales
ALTER TABLE "sales" ADD COLUMN "chipIccid" TEXT;
ALTER TABLE "sales" ADD COLUMN "simCardId" TEXT;
ALTER TABLE "sales" ADD COLUMN "contractFormat" "ContractFormat";

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_simCardId_fkey" FOREIGN KEY ("simCardId") REFERENCES "sim_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "sales_simCardId_idx" ON "sales"("simCardId");
