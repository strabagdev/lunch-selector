-- CreateEnum
CREATE TYPE "CalorieEstimateStatus" AS ENUM ('PENDING', 'ESTIMATED', 'FAILED');

-- AlterTable
ALTER TABLE "MenuOption"
ADD COLUMN "caloriesKcal" INTEGER,
ADD COLUMN "calorieEstimateStatus" "CalorieEstimateStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "calorieEstimatedAt" TIMESTAMP(3),
ADD COLUMN "calorieEstimateModel" TEXT;
