-- CreateEnum
CREATE TYPE "DailyReportDeliveryChannel" AS ENUM ('EMAIL', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "DailyReportDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "DailyReportDelivery" (
    "id" TEXT NOT NULL,
    "menuDayId" TEXT NOT NULL,
    "channel" "DailyReportDeliveryChannel" NOT NULL,
    "recipientKey" VARCHAR(191) NOT NULL,
    "destination" TEXT NOT NULL,
    "status" "DailyReportDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "leaseToken" VARCHAR(36),
    "leaseExpiresAt" TIMESTAMP(3),
    "providerDeliveryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReportDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyReportDelivery_menuDayId_channel_recipientKey_key"
ON "DailyReportDelivery"("menuDayId", "channel", "recipientKey");

-- CreateIndex
CREATE INDEX "DailyReportDelivery_status_leaseExpiresAt_idx"
ON "DailyReportDelivery"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "DailyReportDelivery_menuDayId_idx"
ON "DailyReportDelivery"("menuDayId");

-- AddForeignKey
ALTER TABLE "DailyReportDelivery"
ADD CONSTRAINT "DailyReportDelivery_menuDayId_fkey"
FOREIGN KEY ("menuDayId") REFERENCES "MenuDay"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
