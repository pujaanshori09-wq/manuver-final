-- CreateEnum
CREATE TYPE "AppLanguage" AS ENUM ('EN', 'ID');

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "language" "AppLanguage";
