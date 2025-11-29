-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "descriptionJson" JSONB;

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "descriptionJson" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bioJson" JSONB;
