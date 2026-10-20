ALTER TABLE "partners" ADD COLUMN "billedByLuxus" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "sales" ALTER COLUMN "billedByLuxus" SET DEFAULT false;

-- Parceiros começam sem cobrança pela Luxus: as vendas em aberto passam a seguir o parceiro.
UPDATE "sales"
SET "billedByLuxus" = false
WHERE "status" NOT IN ('ACTIVATED', 'CANCELLED', 'REJECTED');
