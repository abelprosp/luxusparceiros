-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'VIEW';

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "refresh_tokens" ADD COLUMN     "familyId" TEXT,
ADD COLUMN     "rotatedAt" TIMESTAMP(3);

-- Tokens de sessão passam a ser guardados só como SHA-256; as sessões abertas continuam válidas.
UPDATE "refresh_tokens" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex'), "familyId" = "id";

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coordination_entries" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "owner" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coordination_entries_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "outbox_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_tokenHash_key" ON "password_reset_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_userId_idx" ON "password_reset_tokens"("userId");

-- CreateIndex
CREATE INDEX "coordination_entries_expiresAt_idx" ON "coordination_entries"("expiresAt");

-- CreateIndex
CREATE INDEX "outbox_events_status_nextAttemptAt_idx" ON "outbox_events"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "outbox_events_type_aggregateId_key" ON "outbox_events"("type", "aggregateId");

-- CreateIndex
CREATE INDEX "refresh_tokens_familyId_idx" ON "refresh_tokens"("familyId");

-- CreateIndex
CREATE INDEX "clients_partnerId_document_idx" ON "clients"("partnerId", "document");

-- CreateIndex
CREATE INDEX "clients_partnerId_createdAt_idx" ON "clients"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_partnerId_createdAt_idx" ON "sales"("partnerId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_partnerId_status_idx" ON "sales"("partnerId", "status");

-- CreateIndex
CREATE INDEX "sales_branchId_createdAt_idx" ON "sales"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "sales_clientId_idx" ON "sales"("clientId");

-- CreateIndex
CREATE INDEX "sales_createdById_idx" ON "sales"("createdById");

-- CreateIndex
CREATE INDEX "sales_lineId_idx" ON "sales"("lineId");

-- CreateIndex
CREATE INDEX "sales_status_activatedAt_idx" ON "sales"("status", "activatedAt");

-- CreateIndex
CREATE INDEX "documents_requestId_idx" ON "documents"("requestId");

-- CreateIndex
CREATE INDEX "documents_ticketId_idx" ON "documents"("ticketId");

-- CreateIndex
CREATE INDEX "documents_url_idx" ON "documents"("url");

-- CreateIndex
CREATE INDEX "commissions_partnerId_status_idx" ON "commissions"("partnerId", "status");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preparação para UNIQUE (partnerId, document) em clients: lista os documentos repetidos que precisam
-- ser unificados antes de criar a constraint. Consulta: SELECT * FROM "client_document_duplicates";
CREATE VIEW "client_document_duplicates" AS
SELECT "partnerId", regexp_replace("document", '\D', '', 'g') AS "normalizedDocument", COUNT(*)::int AS "total",
       array_agg("id" ORDER BY "createdAt") AS "clientIds"
FROM "clients"
GROUP BY "partnerId", regexp_replace("document", '\D', '', 'g')
HAVING COUNT(*) > 1;
