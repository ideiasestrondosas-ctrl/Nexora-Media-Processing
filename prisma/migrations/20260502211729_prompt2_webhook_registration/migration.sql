-- CreateEnum
CREATE TYPE "WebhookEvent" AS ENUM ('ASSET_INGESTED', 'ASSET_QC_PASSED', 'ASSET_QC_QUARANTINED', 'ASSET_QC_REJECTED', 'ASSET_TRANSCODING_STARTED', 'ASSET_TRANSCODING_COMPLETED', 'ASSET_PROCESSING_COMPLETED', 'ASSET_PROCESSING_FAILED', 'JOB_COMPLETED', 'JOB_FAILED');

-- CreateTable
CREATE TABLE "webhook_registrations" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" "WebhookEvent"[],
    "secret" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_registrations_isActive_idx" ON "webhook_registrations"("isActive");
