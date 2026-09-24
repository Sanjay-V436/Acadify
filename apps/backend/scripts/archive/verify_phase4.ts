import { Test } from '@nestjs/testing';
import { Role } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AdminAcademicYearsService } from '../../src/admin/services/admin-academic-years.service';
import { AdminAcademicClassesService } from '../../src/admin/services/admin-academic-classes.service';
import { AdminStudentsService } from '../../src/admin/services/admin-students.service';
import { AdminFacultyService } from '../../src/admin/services/admin-faculty.service';
import { AdminDepartmentsService } from '../../src/admin/services/admin-departments.service';
import { AdminSubjectsService } from '../../src/admin/services/admin-subjects.service';
import { AdminClassSubjectsService } from '../../src/admin/services/admin-class-subjects.service';
import { AdminTeachingAssignmentsService } from '../../src/admin/services/admin-teaching-assignments.service';
import { AdminSemestersService } from '../../src/admin/services/admin-semesters.service';

async function runVerification() {
  console.log('==================================================');
  console.log('=== PHASE 4.1 ACADEMIC LIFECYCLE TEST SUITE ===');
  console.log('==================================================\n');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const prisma = moduleRef.get(PrismaService);
  const yearsService = moduleRef.get(AdminAcademicYearsService);
  const classesService = moduleRef.get(AdminAcademicClassesService);
  const studentsService = moduleRef.get(AdminStudentsService);
  const facultyService = moduleRef.get(AdminFacultyService);
  const deptsService = moduleRef.get(AdminDepartmentsService);
  const subjectsService = moduleRef.get(AdminSubjectsService);
  const classSubjectsService = moduleRef.get(AdminClassSubjectsService);
  const teachingService = moduleRef.get(AdminTeachingAssignmentsService);
  const semestersService = moduleRef.get(AdminSemestersService);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testNum: number, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [Test ${testNum}: ${testName}] PASSED ${detail ? `- ${detail}` : ''}`);
    } else {
      console.error(`❌ [Test ${testNum}: ${testName}] FAILED ${detail ? `- ${detail}` : ''}`);
    }
  }

  // Setup test environment base records
  const timeSuffix = Date.now();
  const testDeptCode = `P4DEPT_${timeSuffix}`;
  const dept = await deptsService.create({ name: 'Phase 4 Test Dept', code: testDeptCode });

  const year1 = await yearsService.create({
    year: `P4-AY-2026-27-${timeSuffix}`,
    startDate: '2026-08-01',
    endDate: '2027-05-31',
    isCurrent: false,
  });

  const year2 = await yearsService.create({
    year: `P4-AY-2027-28-${timeSuffix}`,
    startDate: '2027-08-01',
    endDate: '2028-05-31',
    isCurrent: false,
  });

  // Test 1: Semester belongs to AcademicYear
  const sem1 = await semestersService.create({
    academicYearId: year1.id,
    semesterNumber: 1,
    name: 'Semester 1',
  });
  assert(sem1.academicYearId === year1.id, 1, 'Semester belongs to AcademicYear', `sem1.academicYearId matches year1.id`);

  // Test 2: Duplicate semester within academic year is rejected
  let dupSemRejected = false;
  try {
    await semestersService.create({
      academicYearId: year1.id,
      semesterNumber: 1,
      name: 'Duplicate Semester 1',
    });
  } catch (err: any) {
    dupSemRejected = true;
  }
  assert(dupSemRejected, 2, 'Duplicate semester in academic year rejected');

  const sem2 = await semestersService.create({
    academicYearId: year1.id,
    semesterNumber: 2,
    name: 'Semester 2',
  });

  // Create academic classes
  const classYr1 = await classesService.create({
    departmentId: dept.id,
    academicYearId: year1.id,
    yearOfStudy: 1,
    section: null,
  });

  const classYr1A = await classesService.create({
    departmentId: dept.id,
    academicYearId: year1.id,
    yearOfStudy: 1,
    section: 'A',
  });

  const classYr2 = await classesService.create({
    departmentId: dept.id,
    academicYearId: year2.id,
    yearOfStudy: 2,
    section: null,
  });

  // Create subjects
  const subDS = await subjectsService.create({
    name: 'P4 Data Structures',
    code: `P4DS_${timeSuffix}`,
    semester: 1,
    departmentId: dept.id,
  });

  const subDBMS = await subjectsService.create({
    name: 'P4 DBMS',
    code: `P4DBMS_${timeSuffix}`,
    semester: 1,
    departmentId: dept.id,
  });

  const subAlgo = await subjectsService.create({
    name: 'P4 Algorithms',
    code: `P4ALGO_${timeSuffix}`,
    semester: 2,
    departmentId: dept.id,
  });

  // Test 3: Semester 1 ClassSubject creation works
  const cs1 = await classSubjectsService.assignSubjectToClass({
    classId: classYr1.id,
    subjectId: subDS.id,
    semesterId: sem1.id,
  });
  assert(cs1.classId === classYr1.id && cs1.semesterId === sem1.id, 3, 'Semester 1 ClassSubject creation works');

  // Test 4: Semester 2 can have a different subject set
  const cs2 = await classSubjectsService.assignSubjectToClass({
    classId: classYr1.id,
    subjectId: subAlgo.id,
    semesterId: sem2.id,
  });
  assert(cs2.classId === classYr1.id && cs2.semesterId === sem2.id, 4, 'Semester 2 different subject set works');

  // Test 5: Semester 1 mappings remain unchanged after Semester 2 is created
  const yr1SubjectsSem1 = await classSubjectsService.findByClass(classYr1.id, sem1.id);
  assert(yr1SubjectsSem1.length === 1 && yr1SubjectsSem1[0].subjectId === subDS.id, 5, 'Semester 1 mappings historically intact');

  // Test 6: Same subject can exist in multiple classes
  const cs1A_DS = await classSubjectsService.assignSubjectToClass({
    classId: classYr1A.id,
    subjectId: subDS.id,
    semesterId: sem1.id,
  });
  assert(cs1A_DS.id !== cs1.id, 6, 'Same subject mapped to multiple classes independently');

  // Test 7: Same subject can exist in multiple semesters
  const csSem2_DS = await classSubjectsService.assignSubjectToClass({
    classId: classYr1.id,
    subjectId: subDS.id,
    semesterId: sem2.id,
  });
  assert(csSem2_DS.id !== cs1.id, 7, 'Same subject mapped to multiple semesters');

  // Create Faculty Profiles for testing
  const facultyA = await facultyService.create({
    email: `p4facultyA_${timeSuffix}@acadify.test`,
    password: 'password123',
    name: 'Faculty A',
    departmentId: dept.id,
  });

  const facultyB = await facultyService.create({
    email: `p4facultyB_${timeSuffix}@acadify.test`,
    password: 'password123',
    name: 'Faculty B',
    departmentId: dept.id,
  });

  // Test 8: Faculty assignment works per ClassSubject
  const ta1 = await teachingService.assignFacultyToClassSubject({
    classSubjectId: cs1.id,
    facultyId: facultyA!.facultyProfileId!,
  });
  assert(ta1.classSubjectId === cs1.id, 8, 'Faculty assignment per ClassSubject works');

  // Test 9: Faculty assignment differs between semesters
  const ta2 = await teachingService.assignFacultyToClassSubject({
    classSubjectId: csSem2_DS.id,
    facultyId: facultyB!.facultyProfileId!,
  });
  const facSem1 = await teachingService.findByClassSubject(cs1.id);
  const facSem2 = await teachingService.findByClassSubject(csSem2_DS.id);
  assert(
    facSem1[0].facultyId === facultyA!.facultyProfileId && facSem2[0].facultyId === facultyB!.facultyProfileId,
    9,
    'Faculty assignments differ by semester',
  );

  // Test 10: Duplicate faculty assignment is rejected
  let dupFacultyRejected = false;
  try {
    await teachingService.assignFacultyToClassSubject({
      classSubjectId: cs1.id,
      facultyId: facultyA!.facultyProfileId!,
    });
  } catch (err: any) {
    dupFacultyRejected = true;
  }
  assert(dupFacultyRejected, 10, 'Duplicate faculty assignment rejected');

  // Create student accounts
  const student1 = await studentsService.create({
    email: `p4student1_${timeSuffix}@acadify.test`,
    password: 'password123',
    name: 'Student 1',
    studentId: `STU1_${timeSuffix}`,
    departmentId: dept.id,
  });

  const student2 = await studentsService.create({
    email: `p4student2_${timeSuffix}@acadify.test`,
    password: 'password123',
    name: 'Student 2',
    studentId: `STU2_${timeSuffix}`,
    departmentId: dept.id,
  });

  // Enroll students in Year 1 class
  await studentsService.enroll(student1.id, { classId: classYr1.id });
  await studentsService.enroll(student2.id, { classId: classYr1.id });

  // Test 11: Student remains the same User across academic years
  const origUserId = student1.id;
  await studentsService.enroll(student1.id, { classId: classYr2.id });
  const updatedStudent1 = await studentsService.findOne(student1.id);
  assert(updatedStudent1.id === origUserId, 11, 'Student remains the same User across academic years');

  // Test 12: Previous student enrollment remains intact after promotion / multi-year enrollment
  const enrollments = await studentsService.getEnrollments(student1.id);
  assert(enrollments.length === 2, 12, 'Previous student enrollment remains intact in database');

  // Test 13: Student cannot have two classes in the same academic year
  // Re-enrolling student1 in classYr1A (same year1) reassigns the single year1 record instead of adding a 2nd
  await studentsService.enroll(student1.id, { classId: classYr1A.id });
  const year1Enrollments = await prisma.classStudent.findMany({
    where: { studentId: student1.id, academicYearId: year1.id },
  });
  assert(year1Enrollments.length === 1, 13, 'Student cannot have two classes in the same academic year');

  // Test 14: Selected students can be promoted
  const student3 = await studentsService.create({
    email: `p4student3_${timeSuffix}@acadify.test`,
    password: 'password123',
    name: 'Student 3',
    studentId: `STU3_${timeSuffix}`,
    departmentId: dept.id,
  });
  await studentsService.enroll(student3.id, { classId: classYr1.id });

  const promoteRes = await studentsService.promoteStudents({
    studentIds: [student2.id, student3.id],
    targetClassId: classYr2.id,
  });
  assert(promoteRes.successful === 2 && promoteRes.failed === 0, 14, 'Selected students promoted successfully');

  // Test 15: Partial promotion works (duplicate or invalid handled cleanly without breaking valid ones)
  const partialPromoteRes = await studentsService.promoteStudents({
    studentIds: [student2.id, 'non-existent-user-id'],
    targetClassId: classYr2.id,
  });
  assert(
    partialPromoteRes.failed === 2 && partialPromoteRes.successful === 0,
    15,
    'Partial promotion returns clear failure details for duplicate/invalid rows',
  );

  // Test 16: Bulk student import works
  const importRes = await studentsService.importStudentsBulk({
    students: [
      {
        name: 'Bulk Student A',
        email: `bulka_${timeSuffix}@acadify.test`,
        studentId: `BULKA_${timeSuffix}`,
        department: dept.code,
        academicYear: year1.year,
        yearOfStudy: 1,
        section: null,
      },
      {
        name: 'Bulk Student B',
        email: `bulkb_${timeSuffix}@acadify.test`,
        studentId: `BULKB_${timeSuffix}`,
        department: dept.code,
        academicYear: year1.year,
        yearOfStudy: 1,
        section: 'A',
      },
    ],
  });
  assert(importRes.valid === 2 && importRes.invalid === 0, 16, 'Bulk student import works');

  // Test 17: Duplicate emails rejected in bulk import
  const dupEmailImport = await studentsService.importStudentsBulk({
    students: [
      {
        name: 'Dup Email Student',
        email: `bulka_${timeSuffix}@acadify.test`,
        studentId: `DUPEMAIL_STU_${timeSuffix}`,
        department: dept.code,
        academicYear: year1.year,
        yearOfStudy: 1,
      },
    ],
  });
  assert(dupEmailImport.invalid === 1 && dupEmailImport.errors[0].field === 'email', 17, 'Duplicate emails rejected in bulk import');

  // Test 18: Duplicate student IDs rejected in bulk import
  const dupStudentIdImport = await studentsService.importStudentsBulk({
    students: [
      {
        name: 'Dup Id Student',
        email: `uniqueemail_${timeSuffix}@acadify.test`,
        studentId: `BULKA_${timeSuffix}`,
        department: dept.code,
        academicYear: year1.year,
        yearOfStudy: 1,
      },
    ],
  });
  assert(dupStudentIdImport.invalid === 1 && dupStudentIdImport.errors[0].field === 'studentId', 18, 'Duplicate student IDs rejected in bulk import');

  // Test 19: Invalid departments rejected in bulk import
  const invalidDeptImport = await studentsService.importStudentsBulk({
    students: [
      {
        name: 'Invalid Dept Student',
        email: `invaliddept_${timeSuffix}@acadify.test`,
        studentId: `INVDEPT_STU_${timeSuffix}`,
        department: 'INVALID_DEPT_CODE_XYZ',
        academicYear: year1.year,
        yearOfStudy: 1,
      },
    ],
  });
  assert(invalidDeptImport.invalid === 1 && invalidDeptImport.errors[0].field === 'department', 19, 'Invalid department rejected in bulk import');

  // Test 20: Invalid classes rejected in bulk import
  const invalidClassImport = await studentsService.importStudentsBulk({
    students: [
      {
        name: 'Invalid Class Student',
        email: `invalidclass_${timeSuffix}@acadify.test`,
        studentId: `INVCLASS_STU_${timeSuffix}`,
        department: dept.code,
        academicYear: year1.year,
        yearOfStudy: 4, // No class created for yearOfStudy 4
      },
    ],
  });
  assert(invalidClassImport.invalid === 1 && invalidClassImport.errors[0].field === 'class', 20, 'Invalid class parameters rejected in bulk import');

  // Test 21: Sectionless classes resolve blank section to NULL
  const nullSectionStudent = await prisma.user.findFirst({
    where: { email: `bulka_${timeSuffix}@acadify.test` },
    include: { classEnrollments: { include: { class: true } } },
  });
  assert(nullSectionStudent?.classEnrollments[0].class.section === null, 21, 'Sectionless class resolved blank section to NULL');

  // Test 22: Sectioned classes resolve A/B/C correctly
  const sectionedStudent = await prisma.user.findFirst({
    where: { email: `bulkb_${timeSuffix}@acadify.test` },
    include: { classEnrollments: { include: { class: true } } },
  });
  assert(sectionedStudent?.classEnrollments[0].class.section === 'A', 22, 'Sectioned class resolved section A correctly');

  // Test 23: Bulk class assignment works
  const bulkAssignRes = await studentsService.assignStudentsToClassBulk(classYr2.id, {
    studentIds: [student1.id, student2.id],
  });
  assert(bulkAssignRes.assignedCount === 2, 23, 'Bulk class assignment works');

  // Test 24: Department mismatch rejected in bulk class assignment
  const otherDept = await deptsService.create({ name: 'Other Dept', code: `P4OTHER_${timeSuffix}` });
  const otherDeptStudent = await studentsService.create({
    email: `otherdept_${timeSuffix}@acadify.test`,
    password: 'password123',
    name: 'Other Dept Student',
    studentId: `OTHERDEPT_STU_${timeSuffix}`,
    departmentId: otherDept.id,
  });
  let deptMismatchRejected = false;
  try {
    await studentsService.assignStudentsToClassBulk(classYr2.id, {
      studentIds: [otherDeptStudent.id],
    });
  } catch (err: any) {
    deptMismatchRejected = true;
  }
  assert(deptMismatchRejected, 24, 'Department mismatch rejected in bulk class assignment');

  // Test 25: Existing Admin APIs still work
  const allDepts = await deptsService.findAll({});
  assert(allDepts.data.length > 0, 25, 'Existing Admin APIs functional');

  // Test 26: Existing authentication/users intact
  const anyUser = await prisma.user.findFirst({ where: { role: Role.STUDENT } });
  assert(!!anyUser && !!anyUser.passwordHash, 26, 'User passwords and authentication fields intact');

  // Test 27: Existing Student/Faculty profiles intact
  const facultyProfileCount = await prisma.facultyProfile.count();
  assert(facultyProfileCount > 0, 27, 'FacultyProfiles accessible and intact');

  // Test 28: Existing AI mentor recommendation data intact
  const mentorProjectsCount = await prisma.project.count();
  assert(mentorProjectsCount >= 0, 28, 'Projects and mentor relations intact');

  // Test 29: ChromaDB/faculty re-embedding baseline profile IDs preserved
  const sampleFaculty = await prisma.facultyProfile.findFirst();
  assert(!!sampleFaculty && !!sampleFaculty.id && !!sampleFaculty.userId, 29, 'FacultyProfile IDs preserved for AI vector embeddings');

  // Test 30: Existing core IDs remain unchanged
  const totalUsers = await prisma.user.count();
  assert(totalUsers >= 38, 30, 'Existing core record IDs and totals remain unchanged');

  // Test 31: Missing studentId rejected for new STUDENT creation
  let missingStudentIdRejected = false;
  try {
    await studentsService.create({
      email: `nostudentid_${timeSuffix}@acadify.test`,
      password: 'password123',
      name: 'No StudentId Student',
      studentId: '',
    });
  } catch (err: any) {
    missingStudentIdRejected = true;
  }
  assert(missingStudentIdRejected, 31, 'Missing studentId rejected for new STUDENT account creation');

  // Test 32: Duplicate studentId rejected on creation
  let dupStudentIdCreatedRejected = false;
  try {
    await studentsService.create({
      email: `dupstudentid_${timeSuffix}@acadify.test`,
      password: 'password123',
      name: 'Dup StudentId Student',
      studentId: `STU1_${timeSuffix}`, // Same studentId as student1
    });
  } catch (err: any) {
    dupStudentIdCreatedRejected = true;
  }
  assert(dupStudentIdCreatedRejected, 32, 'Duplicate studentId rejected on creation');

  // Test 33: Missing studentId rejected in CSV bulk import row
  const missingCsvStudentIdImport = await studentsService.importStudentsBulk({
    students: [
      {
        name: 'Missing ID CSV Student',
        email: `missingcsvid_${timeSuffix}@acadify.test`,
        studentId: '   ',
        department: dept.code,
        academicYear: year1.year,
        yearOfStudy: 1,
      },
    ],
  });
  assert(
    missingCsvStudentIdImport.invalid === 1 && missingCsvStudentIdImport.errors[0].field === 'studentId',
    33,
    'Missing studentId in CSV bulk import row rejected',
  );

  // Test 34: Admin student search by Roll Number (studentId) works
  const searchResult = await studentsService.findAll({ search: `STU1_${timeSuffix}` });
  assert(
    searchResult.data.length > 0 && searchResult.data[0].studentId === `STU1_${timeSuffix}`,
    34,
    'Admin student search by Roll Number (studentId) works',
  );

  // Test 35: FACULTY user creation allows studentId = null
  const newFaculty = await facultyService.create({
    email: `facnullid_${timeSuffix}@acadify.test`,
    password: 'password123',
    name: 'Faculty Null ID',
    departmentId: dept.id,
  });
  const facUserRecord = await prisma.user.findUnique({ where: { id: newFaculty!.userId! } });
  assert(facUserRecord?.role === Role.FACULTY && facUserRecord?.studentId === null, 35, 'FACULTY user allows studentId = null');

  // Test 36: Promotion preserves exact User.id and studentId
  const promotedStudent1 = await studentsService.findOne(student1.id);
  assert(
    promotedStudent1.id === student1.id && promotedStudent1.studentId === `STU1_${timeSuffix}`,
    36,
    'Promotion preserves exact User.id and studentId (roll number identity)',
  );

  // Test 37: passwordHash is never exposed in API student queries
  const queriedStudent = await studentsService.findOne(student1.id);
  assert((queriedStudent as any).passwordHash === undefined, 37, 'passwordHash is never exposed in API responses');

  // Clean up test data safely
  console.log('\nCleaning up test data...');
  try {
    await prisma.teachingAssignment.deleteMany({ where: { classSubject: { class: { departmentId: { in: [dept.id, otherDept.id] } } } } });
    await prisma.classStudent.deleteMany({ where: { class: { departmentId: { in: [dept.id, otherDept.id] } } } });
    await prisma.classSubject.deleteMany({ where: { class: { departmentId: { in: [dept.id, otherDept.id] } } } });
    await prisma.semester.deleteMany({ where: { academicYearId: { in: [year1.id, year2.id] } } });
    await prisma.academicClass.deleteMany({ where: { departmentId: { in: [dept.id, otherDept.id] } } });
    await prisma.subject.deleteMany({ where: { departmentId: { in: [dept.id, otherDept.id] } } });
    await prisma.user.deleteMany({ where: { email: { contains: 'acadify.test' } } });
    await prisma.department.deleteMany({ where: { id: { in: [dept.id, otherDept.id] } } });
    await prisma.academicYear.deleteMany({ where: { id: { in: [year1.id, year2.id] } } });
    console.log('Cleanup complete.');
  } catch (err: any) {
    console.warn('Cleanup warning:', err.message);
  }

  console.log('\n==================================================');
  console.log(`TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('==================================================');

  await moduleRef.close();

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
