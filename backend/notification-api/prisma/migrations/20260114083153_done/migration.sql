-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "activity" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "marketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "social" BOOLEAN NOT NULL DEFAULT true;
