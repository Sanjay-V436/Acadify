-- CreateTable
CREATE TABLE "Semester" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "semesterNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Semester_pkey" PRIMARY KEY ("id")
);

-- DropIndex
DROP INDEX IF EXISTS "ClassSubject_classId_subjectId_key";

-- AlterTable
ALTER TABLE "ClassSubject" ADD COLUMN "semesterId" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Semester_academicYearId_semesterNumber_key" ON "Semester"("academicYearId", "semesterNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ClassSubject_classId_subjectId_semesterId_key" ON "ClassSubject"("classId", "subjectId", "semesterId");

-- AddForeignKey
ALTER TABLE "Semester" ADD CONSTRAINT "Semester_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_semesterId_fkey" FOREIGN KEY ("semesterId") REFERENCES "Semester"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
