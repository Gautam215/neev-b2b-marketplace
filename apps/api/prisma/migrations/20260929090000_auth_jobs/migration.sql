-- Add account status and request idempotency ownership.
ALTER TABLE "User" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "QuoteRequest" ADD COLUMN "idempotencyHash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "QuoteRequest" ALTER COLUMN "idempotencyHash" DROP DEFAULT;
DROP INDEX "QuoteRequest_idempotencyKey_key";
CREATE UNIQUE INDEX "QuoteRequest_buyerOrgId_idempotencyKey_key" ON "QuoteRequest"("buyerOrgId", "idempotencyKey");

-- Make dispatch writes idempotent and retain delivery proof for reconciliation.
ALTER TABLE "DispatchEvent" ADD COLUMN "deliveredPieces" INTEGER;
ALTER TABLE "DispatchEvent" ADD COLUMN "proofReceivedAt" TIMESTAMP(3);
ALTER TABLE "DispatchEvent" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "DispatchEvent_orderId_idempotencyKey_key" ON "DispatchEvent"("orderId", "idempotencyKey");

-- Keep an append-only provider event ledger so webhook retries are harmless.
CREATE TYPE "PaymentWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED');
CREATE TABLE "PaymentWebhookEvent" (
    "id" TEXT NOT NULL,
    "gateway" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "paymentIntentId" TEXT,
    "orderId" TEXT,
    "providerRef" TEXT,
    "status" "PaymentWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "PaymentWebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentWebhookEvent_gateway_eventId_key" ON "PaymentWebhookEvent"("gateway", "eventId");
CREATE INDEX "PaymentWebhookEvent_status_receivedAt_idx" ON "PaymentWebhookEvent"("status", "receivedAt");
