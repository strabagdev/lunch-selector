-- CreateEnum
CREATE TYPE "SelectionSource" AS ENUM ('PUBLIC_WEB', 'ADMIN', 'API');

-- AlterTable
ALTER TABLE "LunchSelection"
ADD COLUMN "source" "SelectionSource",
ADD COLUMN "ipAddress" VARCHAR(45),
ADD COLUMN "userAgent" VARCHAR(512),
ADD COLUMN "sessionId" VARCHAR(36);
