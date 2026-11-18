-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('RUN', 'RIDE', 'HIKE');

-- CreateTable
CREATE TABLE "activities" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "type" "ActivityType" NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "movingSec" INTEGER NOT NULL,
    "distanceM" INTEGER NOT NULL,
    "polyline" TEXT NOT NULL,
    "showOnProfile" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_userId_startedAt_idx" ON "activities"("userId", "startedAt");

-- CreateIndex
CREATE UNIQUE INDEX "activities_userId_clientId_key" ON "activities"("userId", "clientId");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

