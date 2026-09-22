ALTER TABLE "User"
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "programme" TEXT,
  ADD COLUMN "studentId" TEXT,
  ADD COLUMN "academicInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "careerInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "githubUrl" TEXT,
  ADD COLUMN "linkedinUrl" TEXT,
  ADD COLUMN "portfolioUrl" TEXT;

ALTER TABLE "FacultyProfile"
  ADD COLUMN "bio" TEXT,
  ADD COLUMN "qualification" TEXT,
  ADD COLUMN "experienceYears" INTEGER,
  ADD COLUMN "preferredDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "preferredTechnologies" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "facultyWebpageUrl" TEXT,
  ADD COLUMN "googleScholarUrl" TEXT,
  ADD COLUMN "orcidUrl" TEXT,
  ADD COLUMN "linkedinUrl" TEXT;

CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");