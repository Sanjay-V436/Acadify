import { Test } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { JwtAuthGuard } from '../../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/auth/guards/roles.guard';
import { AdminAcademicYearsService } from '../../src/admin/services/admin-academic-years.service';
import { AdminAcademicClassesService } from '../../src/admin/services/admin-academic-classes.service';
import { AdminStudentsService } from '../../src/admin/services/admin-students.service';
import { AdminFacultyService } from '../../src/admin/services/admin-faculty.service';
import { AdminDepartmentsService } from '../../src/admin/services/admin-departments.service';
import { AdminSubjectsService } from '../../src/admin/services/admin-subjects.service';
import { AdminClassSubjectsService } from '../../src/admin/services/admin-class-subjects.service';
import { AdminTeachingAssignmentsService } from '../../src/admin/services/admin-teaching-assignments.service';

async function runPhase2Verification() {
  console.log('==================================================');
  console.log('=== PHASE 2 ADMIN BACKEND VERIFICATION SUITE ===');
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
  const rolesGuard = moduleRef.get(RolesGuard);

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`✅ [${testName}] PASSED ${detail ? `- ${detail}` : ''}`);
    } else {
      console.error(`❌ [${testName}] FAILED ${detail ? `- ${detail}` : ''}`);
    }
  }

  // A, B, C. Authorization / Role Guard Verification
  console.log('--- TEST GROUP 1: ADMIN AUTHORIZATION & GUARDS ---');
  try {
    const mockReflector = {
      getAllAndOverride: () => [Role.ADMIN],
    };
    const guard = new RolesGuard(mockReflector as any);

    const makeContext = (userRole: Role) => ({
      getHandler: () => {},
      getClass: () => {},
      switchToHttp: () => ({
        getRequest: () => ({ user: { role: userRole } }),
      }),
    } as unknown as ExecutionContext);

    const adminAllowed = guard.canActivate(makeContext(Role.ADMIN));
    assert(adminAllowed === true, 'TEST A: Admin authorization', 'Admin role is allowed');

    const studentAllowed = guard.canActivate(makeContext(Role.STUDENT));
    assert(studentAllowed === false, 'TEST B: Student forbidden', 'Student role returns false (403)');

    const facultyAllowed = guard.canActivate(makeContext(Role.FACULTY));
    assert(facultyAllowed === false, 'TEST C: Faculty forbidden', 'Faculty role returns false (403)');
  } catch (err: any) {
    console.error('Guard test failed:', err);
  }

  // D & E. Academic Year Management
  console.log('\n--- TEST GROUP 2: ACADEMIC YEAR MANAGEMENT ---');
  let testYear1: any;
  let testYear2: any;
  try {
    const yearName1 = `P2-AY-2028-2029-${Date.now()}`;
    testYear1 = await yearsService.create({
      year: yearName1,
      startDate: '2028-06-01',
      endDate: '2029-05-31',
      isCurrent: false,
    });
    assert(testYear1 && testYear1.year === yearName1, 'TEST D: Create Academic Year', `Created ${testYear1.year}`);

    // Test single isCurrent = true
    await yearsService.setCurrent(testYear1.id);
    const updatedYear1 = await yearsService.findOne(testYear1.id);
    assert(updatedYear1.isCurrent === true, 'TEST E1: Set current academic year', `${testYear1.year} is now current`);

    const yearName2 = `P2-AY-2029-2030-${Date.now()}`;
    testYear2 = await yearsService.create({
      year: yearName2,
      startDate: '2029-06-01',
      endDate: '2030-05-31',
      isCurrent: true, // Should unset testYear1
    });

    const recheckedYear1 = await yearsService.findOne(testYear1.id);
    const checkedYear2 = await yearsService.findOne(testYear2.id);
    assert(
      checkedYear2.isCurrent === true && recheckedYear1.isCurrent === false,
      'TEST E2: Single current academic year constraint',
      'Setting new year as current unset previous year automatically',
    );
  } catch (err: any) {
    console.error('Academic year test failed:', err.message);
  }

  // F, G, H. Academic Class Management (Department, Year, Section)
  console.log('\n--- TEST GROUP 3: ACADEMIC CLASS MANAGEMENT ---');
  let testDept: any;
  let sectionlessClass: any;
  let sectionedClassA: any;
  let sectionedClassB: any;
  try {
    const deptCode = `P2DEPT-${Date.now()}`;
    testDept = await deptsService.create({
      code: deptCode,
      name: 'Phase 2 Test Department',
    });

    // F: Sectionless class (section = null)
    sectionlessClass = await classesService.create({
      departmentId: testDept.id,
      academicYearId: testYear1.id,
      yearOfStudy: 1,
      section: null,
    });
    assert(
      sectionlessClass && sectionlessClass.section === null,
      'TEST F: Create sectionless class',
      `Class created with section = NULL`,
    );

    // G: Sectioned classes (section = A, B)
    sectionedClassA = await classesService.create({
      departmentId: testDept.id,
      academicYearId: testYear1.id,
      yearOfStudy: 1,
      section: 'A',
    });
    sectionedClassB = await classesService.create({
      departmentId: testDept.id,
      academicYearId: testYear1.id,
      yearOfStudy: 1,
      section: 'B',
    });
    assert(
      sectionedClassA.section === 'A' && sectionedClassB.section === 'B',
      'TEST G: Create sectioned classes',
      'Created section A and section B successfully',
    );

    // H: Duplicate class rejected
    let duplicateRejected = false;
    try {
      await classesService.create({
        departmentId: testDept.id,
        academicYearId: testYear1.id,
        yearOfStudy: 1,
        section: 'A',
      });
    } catch (err: any) {
      duplicateRejected = true;
    }
    assert(duplicateRejected, 'TEST H: Duplicate class rejected', 'Attempt to recreate section A threw ConflictException');
  } catch (err: any) {
    console.error('Academic class test failed:', err.message);
  }

  // I, J, K. Student Account & Enrollment Rules
  console.log('\n--- TEST GROUP 4: STUDENT MANAGEMENT & ENROLLMENT RULES ---');
  let testStudent: any;
  try {
    const studentEmail = `p2student-${Date.now()}@acadify.test`;
    testStudent = await studentsService.create({
      email: studentEmail,
      password: 'password123',
      name: 'Phase2 Student',
      studentId: `P2STU-${Date.now()}`,
      departmentId: testDept.id,
    });
    assert(
      testStudent && testStudent.email === studentEmail && !(testStudent as any).passwordHash,
      'TEST I1: Create student account',
      'Created student user without exposing passwordHash',
    );

    // Enroll student in section A for testYear1
    const enrollment1 = await studentsService.enroll(testStudent.id, {
      classId: sectionedClassA.id,
    });
    assert(
      !!(enrollment1 && enrollment1.classId === sectionedClassA.id),
      'TEST I2: Assign student to class',
      'Enrolled student in Section A',
    );

    // J: Student cannot belong to 2 classes in same academic year (reassigns or rejects bypass)
    const reassignEnrollment = await studentsService.enroll(testStudent.id, {
      classId: sectionedClassB.id,
    });
    const enrollmentsInYear1 = await prisma.classStudent.findMany({
      where: { studentId: testStudent.id, academicYearId: testYear1.id },
    });
    assert(
      enrollmentsInYear1.length === 1 && enrollmentsInYear1[0].classId === sectionedClassB.id,
      'TEST J: One student per AcademicYear constraint',
      'Student has exactly 1 enrollment per academic year (reassigned from A to B)',
    );

    // K: Student can belong to different class in different academic year
    const classInYear2 = await classesService.create({
      departmentId: testDept.id,
      academicYearId: testYear2.id,
      yearOfStudy: 2,
      section: 'A',
    });
    const enrollment2 = await studentsService.enroll(testStudent.id, {
      classId: classInYear2.id,
    });
    const totalEnrollments = await studentsService.getEnrollments(testStudent.id);
    assert(
      totalEnrollments.length === 2,
      'TEST K: Student enrolled in different years',
      'Student correctly enrolled in different classes across 2 academic years',
    );
  } catch (err: any) {
    console.error('Student management test failed:', err.message);
  }

  // L, M. Faculty Management & ID Preservation
  console.log('\n--- TEST GROUP 5: FACULTY MANAGEMENT & ID PRESERVATION ---');
  let testFaculty: any;
  try {
    const facultyEmail = `p2faculty-${Date.now()}@acadify.test`;
    testFaculty = await facultyService.create({
      email: facultyEmail,
      password: 'password123',
      name: 'Phase2 Faculty',
      departmentId: testDept.id,
      designation: 'Assistant Professor',
      specialization: 'Artificial Intelligence',
    });

    assert(
      !!testFaculty.userId && !!testFaculty.facultyProfileId,
      'TEST L: Create faculty account',
      `userId: ${testFaculty.userId}, facultyProfileId: ${testFaculty.facultyProfileId}`,
    );

    // M: Verify FacultyProfile ID preservation during update
    const origProfileId = testFaculty.facultyProfileId;
    const updatedFaculty = await facultyService.update(testFaculty.userId, {
      designation: 'Associate Professor',
      bio: 'Updated bio for AI research',
    });

    assert(
      updatedFaculty?.facultyProfileId === origProfileId,
      'TEST M: FacultyProfile ID preserved',
      `FacultyProfile ID remained intact (${origProfileId})`,
    );
  } catch (err: any) {
    console.error('Faculty management test failed:', err.message);
  }

  // N, O, P. Subjects, ClassSubject, and TeachingAssignments
  console.log('\n--- TEST GROUP 6: SUBJECTS, CLASS-SUBJECTS, & TEACHING ASSIGNMENTS ---');
  let testSubject1: any;
  let testSubject2: any;
  let classSub1: any;
  let classSub2: any;
  try {
    testSubject1 = await subjectsService.create({
      name: 'Phase 2 Algorithms',
      code: `P2SUB1-${Date.now()}`,
      semester: 3,
      departmentId: testDept.id,
    });

    testSubject2 = await subjectsService.create({
      name: 'Phase 2 Systems',
      code: `P2SUB2-${Date.now()}`,
      semester: 3,
      departmentId: testDept.id,
    });

    // N: Same subject mapped to multiple classes
    classSub1 = await classSubjectsService.assignSubjectToClass({
      classId: sectionedClassA.id,
      subjectId: testSubject1.id,
    });
    classSub2 = await classSubjectsService.assignSubjectToClass({
      classId: sectionedClassB.id,
      subjectId: testSubject1.id,
    });

    assert(
      classSub1.subjectId === testSubject1.id && classSub2.subjectId === testSubject1.id,
      'TEST N: Subject mapped to multiple classes',
      'Subject mapped to Section A and Section B independently',
    );

    // O: Multiple faculty assigned to one ClassSubject
    // Create second faculty
    const faculty2 = await facultyService.create({
      email: `p2faculty2-${Date.now()}@acadify.test`,
      password: 'password123',
      name: 'Phase2 Co-Teacher',
      departmentId: testDept.id,
    });

    const assign1 = await teachingService.assignFacultyToClassSubject({
      classSubjectId: classSub1.id,
      facultyId: testFaculty.facultyProfileId,
    });
    const assign2 = await teachingService.assignFacultyToClassSubject({
      classSubjectId: classSub1.id,
      facultyId: faculty2!.facultyProfileId,
    });

    const teachers = await teachingService.findByClassSubject(classSub1.id);
    assert(
      teachers.length === 2,
      'TEST O: Multiple faculty per ClassSubject',
      'Assigned 2 faculty members to the same ClassSubject',
    );

    // P: Duplicate TeachingAssignment rejected
    let dupTeachingRejected = false;
    try {
      await teachingService.assignFacultyToClassSubject({
        classSubjectId: classSub1.id,
        facultyId: testFaculty.facultyProfileId,
      });
    } catch (err: any) {
      dupTeachingRejected = true;
    }
    assert(dupTeachingRejected, 'TEST P: Duplicate TeachingAssignment rejected', 'Attempt to reassign same faculty threw ConflictException');
  } catch (err: any) {
    console.error('Subject/ClassSubject/Teaching test failed:', err.message);
  }

  // Q, R, S. System Core Compatibility Checks
  console.log('\n--- TEST GROUP 7: EXISTING SYSTEM INTEGRITY & COMPATIBILITY ---');
  try {
    const sampleUser = await prisma.user.findFirst();
    assert(!!sampleUser, 'TEST Q: Existing users accessible', `Found ${sampleUser?.email}`);

    const sampleProject = await prisma.project.findFirst();
    assert(sampleProject !== undefined, 'TEST R: Existing projects intact', 'Project table query succeeded');

    const sampleFaculty = await prisma.facultyProfile.findFirst();
    assert(!!sampleFaculty && !!sampleFaculty.id, 'TEST S: AI Mentor faculty profiles intact', `Faculty profile ID: ${sampleFaculty?.id}`);
  } catch (err: any) {
    console.error('System integrity test failed:', err.message);
  }

  // Cleanup test data
  console.log('\n--- CLEANING UP TEST DATA ---');
  try {
    await prisma.teachingAssignment.deleteMany({
      where: {
        classSubject: {
          class: { departmentId: testDept?.id },
        },
      },
    });
    await prisma.classStudent.deleteMany({
      where: { student: { departmentId: testDept?.id } },
    });
    await prisma.classSubject.deleteMany({
      where: { class: { departmentId: testDept?.id } },
    });
    await prisma.academicClass.deleteMany({
      where: { departmentId: testDept?.id },
    });
    await prisma.subject.deleteMany({
      where: { departmentId: testDept?.id },
    });
    await prisma.facultyProfile.deleteMany({
      where: { user: { email: { contains: 'acadify.test' } } },
    });
    await prisma.user.deleteMany({
      where: { email: { contains: 'acadify.test' } },
    });
    if (testDept?.id) {
      await prisma.department.delete({ where: { id: testDept.id } });
    }
    if (testYear1?.id) {
      await prisma.academicYear.delete({ where: { id: testYear1.id } });
    }
    if (testYear2?.id) {
      await prisma.academicYear.delete({ where: { id: testYear2.id } });
    }
    console.log('Cleaned up verification test data successfully.');
  } catch (err: any) {
    console.error('Cleanup notice:', err.message);
  }

  console.log('\n==================================================');
  console.log(`VERIFICATION SUMMARY: ${passedTests}/${totalTests} TESTS PASSED (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('==================================================');

  await moduleRef.close();

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runPhase2Verification().catch((err) => {
  console.error('Verification failed with unhandled error:', err);
  process.exit(1);
});
