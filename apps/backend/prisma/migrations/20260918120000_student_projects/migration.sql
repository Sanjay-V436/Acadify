-- Extend projects for student-owned draft projects.
ALTER TABLE "Project"
  ALTER COLUMN "mentorId" DROP NOT NULL,
  ADD COLUMN "githubUrl" TEXT,
  ADD COLUMN "liveDemoUrl" TEXT,
  ADD COLUMN "imageUrl" TEXT,
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "ProjectStudent_userId_idx" ON "ProjectStudent"("userId");
