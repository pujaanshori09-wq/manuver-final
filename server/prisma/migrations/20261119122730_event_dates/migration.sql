-- DropIndex
DROP INDEX "events_status_createdAt_idx";

-- AlterTable
ALTER TABLE "events" DROP COLUMN "dateText",
DROP COLUMN "priceText",
ADD COLUMN     "priceIdr" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startsAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE INDEX "events_status_startsAt_idx" ON "events"("status", "startsAt");

