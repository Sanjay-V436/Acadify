-- DropForeignKey
ALTER TABLE "AcademicClass" DROP CONSTRAINT IF EXISTS "AcademicClass_academicYearId_fkey";
ALTER TABLE "AcademicClass" DROP CONSTRAINT IF EXISTS "AcademicClass_departmentId_fkey";
ALTER TABLE "ClassStudent" DROP CONSTRAINT IF EXISTS "ClassStudent_academicYearId_fkey";
ALTER TABLE "ClassStudent" DROP CONSTRAINT IF EXISTS "ClassStudent_classId_academicYearId_fkey";
ALTER TABLE "ClassStudent" DROP CONSTRAINT IF EXISTS "ClassStudent_studentId_fkey";
ALTER TABLE "ClassSubject" DROP CONSTRAINT IF EXISTS "ClassSubject_classId_fkey";
ALTER TABLE "ClassSubject" DROP CONSTRAINT IF EXISTS "ClassSubject_semesterId_fkey";
ALTER TABLE "ClassSubject" DROP CONSTRAINT IF EXISTS "ClassSubject_subjectId_fkey";
ALTER TABLE "Resource" DROP CONSTRAINT IF EXISTS "Resource_classSubjectId_fkey";
ALTER TABLE "Semester" DROP CONSTRAINT IF EXISTS "Semester_academicYearId_fkey";
ALTER TABLE "TeachingAssignment" DROP CONSTRAINT IF EXISTS "TeachingAssignment_classSubjectId_fkey";
ALTER TABLE "TeachingAssignment" DROP CONSTRAINT IF EXISTS "TeachingAssignment_facultyId_fkey";

-- AlterTable
ALTER TABLE "Resource" DROP COLUMN IF EXISTS "classSubjectId",
ADD COLUMN IF NOT EXISTS "subjectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "TeachingAssignment" DROP COLUMN IF EXISTS "classSubjectId",
ADD COLUMN IF NOT EXISTS "classId" TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS "subjectId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "classId" TEXT;

-- DropTable
DROP TABLE IF EXISTS "ClassStudent";
DROP TABLE IF EXISTS "TeachingAssignment";
DROP TABLE IF EXISTS "ClassSubject";
DROP TABLE IF EXISTS "AcademicClass";
DROP TABLE IF EXISTS "Semester";
DROP TABLE IF EXISTS "AcademicYear";

-- CreateTable
CREATE TABLE "Class" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "batchYear" INTEGER NOT NULL,
    "section" TEXT,
    "currentSemester" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Class_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeachingAssignment" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,

    CONSTRAINT "TeachingAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Class_departmentId_batchYear_section_key" ON "Class"("departmentId", "batchYear", "section");

-- CreateIndex
CREATE UNIQUE INDEX "TeachingAssignment_classId_subjectId_key" ON "TeachingAssignment"("classId", "subjectId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Class" ADD CONSTRAINT "Class_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeachingAssignment" ADD CONSTRAINT "TeachingAssignment_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "FacultyProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
