/*
  Warnings:

  - You are about to drop the column `path` on the `assets` table. All the data in the column will be lost.
  - The `status` column on the `jobs` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `assetId` to the `jobs` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `jobs` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('PENDING', 'INGESTING', 'QC_RUNNING', 'QC_PASSED', 'QC_QUARANTINED', 'QC_REJECTED', 'TRANSCODING', 'AUDIO_PROCESSING', 'DELIVERING', 'COMPLETED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('INGEST', 'QC', 'TRANSCODE', 'AUDIO', 'PROXY', 'DELIVERY');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QCDecision" AS ENUM ('PASS', 'QUARANTINE', 'REJECT');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('S3', 'FTP', 'HTTP', 'LOCAL');

-- AlterTable
ALTER TABLE "assets" DROP COLUMN "path",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "minioKey" TEXT,
ADD COLUMN     "originalPath" TEXT,
ADD COLUMN     "profile" TEXT,
ADD COLUMN     "sha256" TEXT,
ADD COLUMN     "status" "AssetStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "assetId" TEXT NOT NULL,
ADD COLUMN     "attempt" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "maxAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "startedAt" TIMESTAMP(3),
ADD COLUMN     "workflowRunId" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "JobType" NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "JobStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "qc_reports" (
    "id" TEXT NOT NULL,
    "decision" "QCDecision" NOT NULL,
    "results" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "profile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT NOT NULL,

    CONSTRAINT "qc_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_targets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DeliveryType" NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "delivery_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_delivery_targets" (
    "assetId" TEXT NOT NULL,
    "deliveryTargetId" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "deliveredAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "asset_delivery_targets_pkey" PRIMARY KEY ("assetId","deliveryTargetId")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "ipAddress" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assetId" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "runId" TEXT,
    "taskQueue" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "assetId" TEXT NOT NULL,

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "qc_reports_assetId_idx" ON "qc_reports"("assetId");

-- CreateIndex
CREATE INDEX "qc_reports_decision_idx" ON "qc_reports"("decision");

-- CreateIndex
CREATE INDEX "qc_reports_createdAt_idx" ON "qc_reports"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_targets_name_key" ON "delivery_targets"("name");

-- CreateIndex
CREATE INDEX "delivery_targets_type_idx" ON "delivery_targets"("type");

-- CreateIndex
CREATE INDEX "delivery_targets_isActive_idx" ON "delivery_targets"("isActive");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_assetId_idx" ON "audit_logs"("assetId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_runs_workflowId_key" ON "workflow_runs"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_runs_workflowId_idx" ON "workflow_runs"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_runs_status_idx" ON "workflow_runs"("status");

-- CreateIndex
CREATE INDEX "workflow_runs_assetId_idx" ON "workflow_runs"("assetId");

-- CreateIndex
CREATE INDEX "assets_status_idx" ON "assets"("status");

-- CreateIndex
CREATE INDEX "assets_sha256_idx" ON "assets"("sha256");

-- CreateIndex
CREATE INDEX "assets_createdAt_idx" ON "assets"("createdAt");

-- CreateIndex
CREATE INDEX "assets_deletedAt_idx" ON "assets"("deletedAt");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "jobs_type_idx" ON "jobs"("type");

-- CreateIndex
CREATE INDEX "jobs_assetId_idx" ON "jobs"("assetId");

-- CreateIndex
CREATE INDEX "jobs_createdAt_idx" ON "jobs"("createdAt");

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "workflow_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_reports" ADD CONSTRAINT "qc_reports_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_delivery_targets" ADD CONSTRAINT "asset_delivery_targets_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_delivery_targets" ADD CONSTRAINT "asset_delivery_targets_deliveryTargetId_fkey" FOREIGN KEY ("deliveryTargetId") REFERENCES "delivery_targets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
