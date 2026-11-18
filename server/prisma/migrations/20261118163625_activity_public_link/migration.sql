-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicSlug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "activities_publicSlug_key" ON "activities"("publicSlug");

