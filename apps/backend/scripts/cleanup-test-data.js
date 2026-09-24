/**
 * Acadify Test Data Cleanup Script
 * 
 * WHAT THIS DELETES:
 *   - All TeachingAssignments
 *   - All Resources
 *   - All ClassSubjects
 *   - All ClassStudents (enrollments)
 *   - All AcademicClasses
 *   - All Semesters
 *   - All AcademicYears (the P4 test ones)
 *   - All ProjectStudents
 *   - All Projects
 *   - All Subjects
 *   - All STUDENT users
 *   - Test Departments: P4DEPT_*, P4OTHER_*, QATEST
 *
 * WHAT THIS PRESERVES:
 *   - All FACULTY users and FacultyProfiles
 *   - All ADMIN users
 *   - Departments: CSE, ECE, AI
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  console.log('=== ACADIFY TEST DATA CLEANUP ===\n');

  // 1. TeachingAssignments
  const ta = await prisma.teachingAssignment.deleteMany({});
  console.log(`Deleted ${ta.count} TeachingAssignment(s)`);

  // 2. Resources
  const res = await prisma.resource.deleteMany({});
  console.log(`Deleted ${res.count} Resource(s)`);

  // 3. ClassSubjects
  const cs = await prisma.classSubject.deleteMany({});
  console.log(`Deleted ${cs.count} ClassSubject(s)`);

  // 4. ClassStudents (enrollments)
  const cst = await prisma.classStudent.deleteMany({});
  console.log(`Deleted ${cst.count} ClassStudent enrollment(s)`);

  // 5. AcademicClasses
  const ac = await prisma.academicClass.deleteMany({});
  console.log(`Deleted ${ac.count} AcademicClass(es)`);

  // 6. Semesters
  const sem = await prisma.semester.deleteMany({});
  console.log(`Deleted ${sem.count} Semester(s)`);

  // 7. AcademicYears
  const ay = await prisma.academicYear.deleteMany({});
  console.log(`Deleted ${ay.count} AcademicYear(s)`);

  // 8. ProjectStudents
  const ps = await prisma.projectStudent.deleteMany({});
  console.log(`Deleted ${ps.count} ProjectStudent(s)`);

  // 9. Projects
  const proj = await prisma.project.deleteMany({});
  console.log(`Deleted ${proj.count} Project(s)`);

  // 10. Subjects
  const subj = await prisma.subject.deleteMany({});
  console.log(`Deleted ${subj.count} Subject(s)`);

  // 11. STUDENT users only (preserves FACULTY and ADMIN)
  const students = await prisma.user.deleteMany({ where: { role: 'STUDENT' } });
  console.log(`Deleted ${students.count} STUDENT user(s)`);

  // 12. Test departments only (keeps CSE, ECE, AI)
  const testDepts = await prisma.department.deleteMany({
    where: {
      code: {
        notIn: ['CSE', 'ECE', 'AI'],
      },
    },
  });
  console.log(`Deleted ${testDepts.count} test Department(s)`);

  // --- Final State Report ---
  console.log('\n=== WHAT REMAINS (verification) ===');
  console.log('STUDENT users:', await prisma.user.count({ where: { role: 'STUDENT' } }));
  console.log('FACULTY users:', await prisma.user.count({ where: { role: 'FACULTY' } }));
  console.log('ADMIN users:', await prisma.user.count({ where: { role: 'ADMIN' } }));
  console.log('Faculty Profiles:', await prisma.facultyProfile.count());
  const depts = await prisma.department.findMany({ select: { code: true, name: true } });
  console.log('Departments remaining:', depts.map(d => d.code + ' (' + d.name + ')'));
  console.log('AcademicYears:', await prisma.academicYear.count());
  console.log('AcademicClasses:', await prisma.academicClass.count());
  console.log('Subjects:', await prisma.subject.count());
  console.log('ClassStudents:', await prisma.classStudent.count());
  console.log('Semesters:', await prisma.semester.count());
  console.log('Projects:', await prisma.project.count());

  console.log('\n✅ Cleanup complete. Ready for fresh AI department setup.');
  await prisma.$disconnect();
}

cleanup().catch(async (err) => {
  console.error('Cleanup failed:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
