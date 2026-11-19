-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'REVIEWED', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AbuseKind" AS ENUM ('RATE_LIMIT_HIT', 'FLAGGED');

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_reportedId_fkey";

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_reporterId_fkey";

-- AlterTable
ALTER TABLE "reports" ADD COLUMN     "reportedEmail" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
ALTER COLUMN "reporterId" DROP NOT NULL,
ALTER COLUMN "reportedId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "premiumUntil" TIMESTAMP(3);

-- DropTable
DROP TABLE "phone_otps";

-- CreateTable
CREATE TABLE "swipe_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "action" "SwipeAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "swipe_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "abuse_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "AbuseKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "abuse_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "swipe_events_userId_createdAt_idx" ON "swipe_events"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "abuse_events_userId_kind_createdAt_idx" ON "abuse_events"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "swipe_events" ADD CONSTRAINT "swipe_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abuse_events" ADD CONSTRAINT "abuse_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

