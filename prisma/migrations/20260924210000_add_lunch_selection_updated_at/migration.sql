-- Add the column as nullable so existing rows remain valid during the backfill.
ALTER TABLE "LunchSelection"
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- selectedAt is the only known historical timestamp and is the safest initial value.
UPDATE "LunchSelection"
SET "updatedAt" = "selectedAt";

ALTER TABLE "LunchSelection"
ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE INDEX "LunchSelection_sessionId_idx"
ON "LunchSelection"("sessionId");
