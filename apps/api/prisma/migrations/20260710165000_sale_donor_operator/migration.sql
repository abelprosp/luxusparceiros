-- CreateEnum
CREATE TYPE "DonorOperator" AS ENUM ('VIVO', 'TIM', 'CLARO', 'SURF', 'OTHER');

-- AlterTable
ALTER TABLE "sales" ADD COLUMN "donorOperator" "DonorOperator";
