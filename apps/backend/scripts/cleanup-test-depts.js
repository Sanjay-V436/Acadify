/**
 * Step 2 of cleanup: Remove leftover test departments
 * Pre-requisite: cleanup-test-data.js has already run
 *
 * Problem: Some FACULTY users still have departmentId pointing to test departments.
 * This script nullifies those references first, then deletes the test departments.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanupDepts() {
  console.log('=== CLEANING UP TEST DEPARTMENTS ===\n');

  // Find IDs of departments to keep
  const keepCodes = ['CSE', 'ECE', 'AI'];
  const keepDepts = await prisma.department.findMany({
    where: { code: { in: keepCodes } },
    select: { id: true, code: true },
  });
  const keepIds = keepDepts.map(d => d.id);
  console.log('Keeping departments:', keepDepts.map(d => d.code));

  // Find test departments
  const testDepts = await prisma.department.findMany({
    where: { id: { notIn: keepIds } },
    select: { id: true, code: true, name: true },
  });
  console.log('Test departments to remove:', testDepts.map(d => d.code + ' (' + d.name + ')'));

  if (testDepts.length === 0) {
    console.log('No test departments found. Nothing to do.');
    await prisma.$disconnect();
    return;
  }

  const testDeptIds = testDepts.map(d => d.id);

  // Nullify departmentId on Faculty/Admin users pointing to test departments
  const clearedUsers = await prisma.user.updateMany({
    where: {
      departmentId: { in: testDeptIds },
      role: { in: ['FACULTY', 'ADMIN'] },
    },
    data: { departmentId: null },
  });
  console.log(`\nCleared departmentId on ${clearedUsers.count} FACULTY/ADMIN user(s) that referenced test departments`);

  // Also nullify on FacultyProfile level if it has its own departmentId
  // (FacultyProfile doesn't have departmentId in schema, departmentId is on User)

  // Now delete test departments
  const deleted = await prisma.department.deleteMany({
    where: { id: { notIn: keepIds } },
  });
  console.log(`Deleted ${deleted.count} test Department(s)`);

  // Final state
  console.log('\n=== FINAL STATE ===');
  const remaining = await prisma.department.findMany({ select: { code: true, name: true } });
  console.log('Remaining departments:', remaining.map(d => d.code + ' (' + d.name + ')'));
  console.log('STUDENT users:', await prisma.user.count({ where: { role: 'STUDENT' } }));
  console.log('FACULTY users:', await prisma.user.count({ where: { role: 'FACULTY' } }));
  console.log('ADMIN users:', await prisma.user.count({ where: { role: 'ADMIN' } }));
  console.log('Faculty Profiles:', await prisma.facultyProfile.count());
  console.log('AcademicYears:', await prisma.academicYear.count());
  console.log('AcademicClasses:', await prisma.academicClass.count());
  console.log('Subjects:', await prisma.subject.count());

  console.log('\n✅ All test data removed. Database is clean and ready for real data.');
  await prisma.$disconnect();
}

cleanupDepts().catch(async (err) => {
  console.error('Failed:', err.message);
  await prisma.$disconnect();
  process.exit(1);
});
