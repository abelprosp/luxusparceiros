-- Pedido de vez entre Luxus Task, Parceiros e parceiro (loja)
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "turnRequestFrom" TEXT;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "turnRequestReason" TEXT;
ALTER TABLE "sales" ADD COLUMN IF NOT EXISTS "turnRequestAt" TIMESTAMP(3);
