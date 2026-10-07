-- AlterTable
ALTER TABLE "FacultyProfile" ADD COLUMN "publications" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
