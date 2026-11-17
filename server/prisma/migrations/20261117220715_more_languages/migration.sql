-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppLanguage" ADD VALUE 'ZH';
ALTER TYPE "AppLanguage" ADD VALUE 'ES';
ALTER TYPE "AppLanguage" ADD VALUE 'HI';
ALTER TYPE "AppLanguage" ADD VALUE 'PT';
ALTER TYPE "AppLanguage" ADD VALUE 'RU';
ALTER TYPE "AppLanguage" ADD VALUE 'JA';
ALTER TYPE "AppLanguage" ADD VALUE 'DE';
ALTER TYPE "AppLanguage" ADD VALUE 'FR';
ALTER TYPE "AppLanguage" ADD VALUE 'KO';
ALTER TYPE "AppLanguage" ADD VALUE 'VI';
ALTER TYPE "AppLanguage" ADD VALUE 'TH';
ALTER TYPE "AppLanguage" ADD VALUE 'MS';

