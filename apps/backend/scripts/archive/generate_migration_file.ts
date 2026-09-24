import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const envUrl = "postgresql://postgres.bkjusnqwsxsivesimolw:lP4iKMzPuYC8e9fK@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres";
  const cmd = `npx prisma migrate diff --from-url "${envUrl}" --to-schema-datamodel prisma/schema.prisma --script`;
  
  console.log('Running diff...');
  let rawSql = execSync(cmd, { encoding: 'utf-8', cwd: __dirname });

  // Customization 1: Replace standard unique index on AcademicYear.isCurrent with partial index WHERE "isCurrent" = true
  // Note: if rawSql has created unique index on isCurrent or if we add partial index:
  if (rawSql.includes('CREATE UNIQUE INDEX "AcademicYear_isCurrent_key"')) {
    rawSql = rawSql.replace(
      'CREATE UNIQUE INDEX "AcademicYear_isCurrent_key" ON "AcademicYear"("isCurrent");',
      'CREATE UNIQUE INDEX "AcademicYear_isCurrent_key" ON "AcademicYear"("isCurrent") WHERE "isCurrent" = true;'
    );
  } else {
    rawSql += `\n-- Partial unique index: only ONE AcademicYear may have isCurrent = true\nCREATE UNIQUE INDEX "AcademicYear_isCurrent_key" ON "AcademicYear"("isCurrent") WHERE "isCurrent" = true;\n`;
  }

  // Customization 2: Add NULLS NOT DISTINCT to AcademicClass unique constraint
  if (rawSql.includes('CREATE UNIQUE INDEX "AcademicClass_departmentId_academicYearId_yearOfStudy_section_key"')) {
    rawSql = rawSql.replace(
      'CREATE UNIQUE INDEX "AcademicClass_departmentId_academicYearId_yearOfStudy_section_key" ON "AcademicClass"("departmentId", "academicYearId", "yearOfStudy", "section");',
      'CREATE UNIQUE INDEX "AcademicClass_departmentId_academicYearId_yearOfStudy_section_key" ON "AcademicClass"("departmentId", "academicYearId", "yearOfStudy", "section") NULLS NOT DISTINCT;'
    );
  }

  const migrationDir = path.join(__dirname, 'prisma', 'migrations', '20260921200000_academic_model');
  fs.mkdirSync(migrationDir, { recursive: true });

  const migrationFilePath = path.join(migrationDir, 'migration.sql');
  fs.writeFileSync(migrationFilePath, rawSql, 'utf-8');

  console.log('Migration SQL generated successfully at:', migrationFilePath);
  console.log('--- MIGRATION SQL CONTENT START ---');
  console.log(rawSql);
  console.log('--- MIGRATION SQL CONTENT END ---');
}

main().catch(console.error);
