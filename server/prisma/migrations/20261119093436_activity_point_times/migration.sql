-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "pointTimes" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "segmentStarts" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

