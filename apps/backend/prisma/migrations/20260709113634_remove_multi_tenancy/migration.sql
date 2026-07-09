/*
  Warnings:

  - You are about to drop the column `collegeId` on the `Department` table. All the data in the column will be lost.
  - You are about to drop the column `collegeId` on the `Project` table. All the data in the column will be lost.
  - You are about to drop the column `collegeId` on the `Subject` table. All the data in the column will be lost.
  - You are about to drop the column `collegeId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `College` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[code]` on the table `Department` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[code]` on the table `Subject` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Department" DROP CONSTRAINT "Department_collegeId_fkey";

-- DropForeignKey
ALTER TABLE "Project" DROP CONSTRAINT "Project_collegeId_fkey";

-- DropForeignKey
ALTER TABLE "Subject" DROP CONSTRAINT "Subject_collegeId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_collegeId_fkey";

-- DropIndex
DROP INDEX "Department_collegeId_code_key";

-- AlterTable
ALTER TABLE "Department" DROP COLUMN "collegeId";

-- AlterTable
ALTER TABLE "Project" DROP COLUMN "collegeId";

-- AlterTable
ALTER TABLE "Subject" DROP COLUMN "collegeId";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "collegeId",
ADD COLUMN     "currentSemester" INTEGER,
ADD COLUMN     "departmentId" TEXT;

-- DropTable
DROP TABLE "College";

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "Department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_code_key" ON "Subject"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
