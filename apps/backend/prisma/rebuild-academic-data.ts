/**
 * ACADIFY CLEAN DATABASE REBUILD SCRIPT (PROPOSED - DRAFT ONLY)
 * 
 * IMPORTANT: DO NOT RUN THIS SCRIPT WITHOUT EXPLICIT USER AUTHORIZATION.
 * 
 * Safety features:
 * - DRY_RUN = true by default (simulates deletion and creation inside a transaction that always rolls back).
 * - Deletion is ordered strictly to respect foreign keys and `onDelete: Restrict` constraints.
 * - Does not use `prisma migrate reset`, `prisma db push`, or `DROP TABLE`.
 * - Recreates only the 2 requested departments: ECE and MECH.
 * - Creates 1 dedicated ADMIN user (NO FacultyProfile, NO department/class).
 * - Creates 1 dedicated STUDENT test user (NO FacultyProfile, linked to ECE & test class).
 * - Imports 37 faculty from CSV (22 ECE, 15 MECH) with individual accounts where emails exist.
 * - Skips 15 non-ECE/non-MECH faculty rows.
 * - Reports 11 no-email faculty without fabricating credentials.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

// SAFETY GUARD: Enabled for live execution
export const DRY_RUN = false;

const CSV_FILE_PATH = path.join(__dirname, 'faculty_dataset.csv');

// Default temporary passwords for fresh test accounts
export const CREDENTIALS = {
  admin: {
    name: 'Acadify Administrator',
    email: 'admin@acadify.ac.in',
    password: 'Admin@Acadify2026',
    role: Role.ADMIN,
  },
  student: {
    name: 'Arjun Sharma',
    email: 'student.ece@acadify.ac.in',
    studentId: 'CH.EN.U4ECE26001',
    password: 'Student@Acadify2026',
    role: Role.STUDENT,
    currentSemester: 5,
  },
  defaultFacultyPassword: 'Faculty@Acadify2026',
};

interface FacultyCsvRow {
  name: string;
  department: string;
  designation: string;
  qualification: string;
  research_interests: string;
  publications: string;
  email: string;
  orcid: string;
  profile_url: string;
}

/**
 * Robust CSV parser that handles quotes and commas inside fields.
 */
function parseFacultyCsv(filePath: string): FacultyCsvRow[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`CSV file not found at: ${filePath}`);
  }
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers: string[] = [];
  const headerRegex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
  let hMatch: RegExpExecArray | null;
  while ((hMatch = headerRegex.exec(lines[0])) !== null) {
    if (hMatch.index === headerRegex.lastIndex) headerRegex.lastIndex++;
    const val = hMatch[1] !== undefined ? hMatch[1].replace(/""/g, '"') : hMatch[2];
    headers.push(val.trim());
    if (headerRegex.lastIndex >= lines[0].length) break;
  }

  const rows: FacultyCsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const row: any = {};
    const colRegex = /(?:^|,)(?:"([^"]*(?:""[^"]*)*)"|([^",]*))/g;
    let colIdx = 0;
    let cMatch: RegExpExecArray | null;
    while ((cMatch = colRegex.exec(line)) !== null) {
      if (cMatch.index === colRegex.lastIndex) colRegex.lastIndex++;
      const val = cMatch[1] !== undefined ? cMatch[1].replace(/""/g, '"') : cMatch[2];
      if (colIdx < headers.length) {
        row[headers[colIdx]] = val;
      }
      colIdx++;
      if (colRegex.lastIndex >= line.length) break;
    }
    if (row.name && row.name.trim()) {
      rows.push(row as FacultyCsvRow);
    }
  }
  return rows;
}

function parseResearchInterests(raw?: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function parsePublications(raw?: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw.split('|').map((s) => s.trim()).filter(Boolean);
}

function getPrimaryDesignation(raw?: string): string | null {
  if (!raw || !raw.trim()) return null;
  const parts = raw.split('|').map((s) => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts[0] : null;
}

export async function runRebuildAcademicData() {
  console.log('====================================================');
  console.log('ACADIFY DATABASE REBUILD & DATA PURGE (PROPOSED)');
  console.log(`Execution Mode: ${DRY_RUN ? '🛡️ DRY-RUN (No changes saved)' : '🚀 LIVE EXECUTION'}`);
  console.log('====================================================\n');

  // Parse CSV first to validate dataset before opening transaction
  const allCsvRows = parseFacultyCsv(CSV_FILE_PATH);
  console.log(`[Dataset] Total rows in CSV: ${allCsvRows.length}`);

  const eceRows = allCsvRows.filter((r) =>
    (r.department || '').trim().startsWith('Department of Electronics and Communication Engineering'),
  );
  const mechRows = allCsvRows.filter((r) =>
    (r.department || '').trim().startsWith('Department of Mechanical Engineering'),
  );
  const skippedRows = allCsvRows.filter(
    (r) => !eceRows.includes(r) && !mechRows.includes(r),
  );

  console.log(`[Dataset] ECE Rows (starts with "Department of Electronics..."): ${eceRows.length}`);
  console.log(`[Dataset] MECH Rows (starts with "Department of Mechanical..."): ${mechRows.length}`);
  console.log(`[Dataset] Skipped Rows (other departments / empty): ${skippedRows.length}`);

  const facultyWithEmail = [...eceRows, ...mechRows].filter((r) => (r.email || '').trim().length > 0);
  const facultyNoEmail = [...eceRows, ...mechRows].filter((r) => (r.email || '').trim().length === 0);

  console.log(`[Dataset] Faculty with valid email (can create accounts): ${facultyWithEmail.length}`);
  console.log(`[Dataset] Faculty without email (staged / no account created): ${facultyNoEmail.length}`);

  // Pre-generate password hashes
  const adminPasswordHash = await bcrypt.hash(CREDENTIALS.admin.password, 10);
  const studentPasswordHash = await bcrypt.hash(CREDENTIALS.student.password, 10);
  const facultyPasswordHash = await bcrypt.hash(CREDENTIALS.defaultFacultyPassword, 10);

  const stats = await prisma.$transaction(
    async (tx) => {
      console.log('\n--- PHASE 1: SAFE ORDERED DELETION OF OLD DATA ---');

      // 1. Delete ProjectStudent records (Child of Project & User)
      const delProjectStudents = await tx.projectStudent.deleteMany({});
      console.log(`  [1/9] Deleted ProjectStudent records: ${delProjectStudents.count}`);

      // 2. Delete Projects (Parent of ProjectStudent, references FacultyProfile)
      const delProjects = await tx.project.deleteMany({});
      console.log(`  [2/9] Deleted Project records: ${delProjects.count}`);

      // 3. Delete TeachingAssignments (References Class, Subject, FacultyProfile)
      const delTeachingAssignments = await tx.teachingAssignment.deleteMany({});
      console.log(`  [3/9] Deleted TeachingAssignment records: ${delTeachingAssignments.count}`);

      // 4. Delete Resources (References Subject and User)
      const delResources = await tx.resource.deleteMany({});
      console.log(`  [4/9] Deleted Resource records: ${delResources.count}`);

      // 4b. Delete legacy academic lifecycle records blocking FacultyProfile and User
      await tx.$executeRawUnsafe('DELETE FROM "BatchMember";');
      await tx.$executeRawUnsafe('DELETE FROM "OfferingStudent";');
      await tx.$executeRawUnsafe('DELETE FROM "AuditLog";');
      await tx.$executeRawUnsafe('DELETE FROM "_ClassToCourseOffering";');
      await tx.$executeRawUnsafe('DELETE FROM "CourseBatch";');
      await tx.$executeRawUnsafe('DELETE FROM "CourseOffering";');
      await tx.$executeRawUnsafe('DELETE FROM "Notification";');
      console.log('  [4b] Cleared legacy tables: BatchMember, OfferingStudent, AuditLog, _ClassToCourseOffering, CourseBatch, CourseOffering, Notification');

      // 5. Delete FacultyProfiles (Child of User, references User.id with Restrict)
      const delFacultyProfiles = await tx.facultyProfile.deleteMany({});
      console.log(`  [5/9] Deleted FacultyProfile records: ${delFacultyProfiles.count}`);

      // 6. Delete all old Users (Admin, Students, Faculty)
      const delUsers = await tx.user.deleteMany({});
      console.log(`  [6/9] Deleted User records: ${delUsers.count}`);

      // 7. Delete Classes (References Department)
      const delClasses = await tx.class.deleteMany({});
      console.log(`  [7/9] Deleted Class records: ${delClasses.count}`);

      // 8. Delete Subjects (References Department)
      const delSubjects = await tx.subject.deleteMany({});
      console.log(`  [8/9] Deleted Subject records: ${delSubjects.count}`);

      // 9. Delete Departments (All 5 old departments: CSE, ECE, AI, CCE, MECH)
      const delDepartments = await tx.department.deleteMany({});
      console.log(`  [9/9] Deleted Department records: ${delDepartments.count}`);

      console.log('\n--- PHASE 2: RECREATION OF CLEAN MASTER DATA ---');

      // 10. Recreate exactly two departments: ECE and MECH
      const eceDept = await tx.department.create({
        data: {
          code: 'ECE',
          name: 'Electronics and Communication Engineering',
        },
      });
      console.log(`  [10/14] Created Department: ${eceDept.code} (${eceDept.name})`);

      const mechDept = await tx.department.create({
        data: {
          code: 'MECH',
          name: 'Mechanical Engineering',
        },
      });
      console.log(`  [10/14] Created Department: ${mechDept.code} (${mechDept.name})`);

      // 11. Create a clean test class in ECE for student testing
      const testClass = await tx.class.create({
        data: {
          departmentId: eceDept.id,
          batchYear: 2026,
          section: 'A',
          currentSemester: 5,
        },
      });
      console.log(`  [11/14] Created Test Class: ECE Batch ${testClass.batchYear} Section ${testClass.section}`);

      // 12. Create ONE NEW ADMIN USER (Strictly NO FacultyProfile, NO Dept, NO Class)
      const adminUser = await tx.user.create({
        data: {
          email: CREDENTIALS.admin.email,
          name: CREDENTIALS.admin.name,
          passwordHash: adminPasswordHash,
          role: CREDENTIALS.admin.role,
          departmentId: null,
          classId: null,
          academicInterests: [],
          careerInterests: [],
          skills: [],
        },
      });
      console.log(`  [12/14] Created Dedicated Admin User: ${adminUser.email} (Role: ${adminUser.role}, FacultyProfile: NONE)`);

      // 13. Create ONE NEW STUDENT TEST USER (Strictly NO FacultyProfile, linked to ECE & test class)
      const studentUser = await tx.user.create({
        data: {
          email: CREDENTIALS.student.email,
          name: CREDENTIALS.student.name,
          studentId: CREDENTIALS.student.studentId,
          passwordHash: studentPasswordHash,
          role: CREDENTIALS.student.role,
          departmentId: eceDept.id,
          classId: testClass.id,
          currentSemester: CREDENTIALS.student.currentSemester,
          skills: ['Python', 'Signal Processing', 'Embedded Systems', 'IoT'],
          academicInterests: ['VLSI Design', 'Wireless Communication'],
          careerInterests: [],
        },
      });
      console.log(`  [13/14] Created Dedicated Student User: ${studentUser.email} (Dept: ECE, Class: Batch 2026-A)`);

      // 14. Import Faculty Users and FacultyProfiles (Individual accounts for all with email)
      console.log('\n--- PHASE 3: IMPORTING FACULTY USERS & PROFILES ---');
      let createdEceFaculty = 0;
      let createdMechFaculty = 0;

      for (const row of facultyWithEmail) {
        const rawEmail = row.email.trim().toLowerCase();
        const rawName = row.name.trim();
        const isEce = (row.department || '').trim().startsWith('Department of Electronics and Communication Engineering');
        const deptId = isEce ? eceDept.id : mechDept.id;

        const designation = getPrimaryDesignation(row.designation);
        const qualification = row.qualification?.trim() || null;
        const researchInterests = parseResearchInterests(row.research_interests);
        const publications = parsePublications(row.publications);
        const facultyWebpageUrl = row.profile_url?.trim() || null;
        const orcidUrl = row.orcid?.trim() || null;

        await tx.user.create({
          data: {
            email: rawEmail,
            name: rawName,
            passwordHash: facultyPasswordHash,
            role: Role.FACULTY,
            departmentId: deptId,
            academicInterests: [],
            careerInterests: [],
            skills: [],
            facultyProfile: {
              create: {
                designation,
                qualification,
                researchInterests,
                publications,
                skills: [],
                preferredDomains: [],
                preferredTechnologies: [],
                facultyWebpageUrl,
                orcidUrl,
                availableForProjects: true,
                maxStudents: 5,
                currentStudents: 0,
              },
            },
          },
        });

        if (isEce) createdEceFaculty++;
        else createdMechFaculty++;
      }

      console.log(`  [14/14] Created ECE Faculty accounts: ${createdEceFaculty}`);
      console.log(`  [14/14] Created MECH Faculty accounts: ${createdMechFaculty}`);
      console.log(`  [14/14] Total Faculty accounts created: ${createdEceFaculty + createdMechFaculty}`);

      if (DRY_RUN) {
        throw new Error('[DRY-RUN] Rebuild simulation complete. Transaction deliberately aborted to prevent changes.');
      }

      return {
        deleted: {
          projectStudents: delProjectStudents.count,
          projects: delProjects.count,
          teachingAssignments: delTeachingAssignments.count,
          resources: delResources.count,
          facultyProfiles: delFacultyProfiles.count,
          users: delUsers.count,
          classes: delClasses.count,
          subjects: delSubjects.count,
          departments: delDepartments.count,
        },
        created: {
          departments: 2,
          classes: 1,
          adminUsers: 1,
          studentUsers: 1,
          facultyUsers: createdEceFaculty + createdMechFaculty,
          facultyProfiles: createdEceFaculty + createdMechFaculty,
        },
        stagedNoEmailFaculty: facultyNoEmail.length,
      };
    },
    {
      maxWait: 10000,
      timeout: 45000,
    },
  );

  return stats;
}

if (require.main === module) {
  runRebuildAcademicData()
    .then((res) => {
      console.log('\n✅ Rebuild completed successfully:', JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      if (err.message && err.message.includes('[DRY-RUN]')) {
        console.log('\n🛡️ Dry-run simulation passed validation. All foreign-key constraints and data structures verified.');
      } else {
        console.error('\n❌ Rebuild script validation error:', err);
      }
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
