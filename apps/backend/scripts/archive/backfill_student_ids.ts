import { PrismaClient, Role } from '@prisma/client';

async function backfillStudentIds() {
  const prisma = new PrismaClient();
  try {
    console.log('=== STARTING STUDENT ID BACKFILL ===\n');

    // 1. Sanjay V
    const sanjay = await prisma.user.findFirst({
      where: { email: 'ch.en.u4cce23041@ch.students.amrita.edu' },
    });
    if (sanjay) {
      await prisma.user.update({
        where: { id: sanjay.id },
        data: { studentId: 'CB.EN.U4CCE23041' },
      });
      console.log(`✅ Updated Sanjay V -> studentId: CB.EN.U4CCE23041`);
    }

    // 2. Test Student
    const testStudent = await prisma.user.findFirst({
      where: { email: 'test.student@ch.students.amrita.edu' },
    });
    if (testStudent) {
      await prisma.user.update({
        where: { id: testStudent.id },
        data: { studentId: 'CB.EN.U4CCE23000' },
      });
      console.log(`✅ Updated Test Student -> studentId: CB.EN.U4CCE23000`);
    }

    // 3. Other Dept Student
    const otherDeptStudent = await prisma.user.findFirst({
      where: { email: { contains: 'otherdept_' } },
    });
    if (otherDeptStudent) {
      await prisma.user.update({
        where: { id: otherDeptStudent.id },
        data: { studentId: 'TEST.STUDENT.DEPT2' },
      });
      console.log(`✅ Updated Other Dept Student -> studentId: TEST.STUDENT.DEPT2`);
    }

    // Verification check
    console.log('\n=== VERIFYING DATABASE STATE ===');
    const students = await prisma.user.findMany({ where: { role: Role.STUDENT } });
    const nullStudents = students.filter((s) => !s.studentId || s.studentId.trim() === '');

    const idCounts: Record<string, number> = {};
    students.forEach((s) => {
      if (s.studentId) {
        const id = s.studentId.trim();
        idCounts[id] = (idCounts[id] || 0) + 1;
      }
    });
    const duplicates = Object.entries(idCounts).filter(([_, count]) => count > 1);

    const nonStudentWithId = await prisma.user.findMany({
      where: {
        role: { in: [Role.FACULTY, Role.ADMIN] },
        studentId: { not: null },
      },
    });

    console.log(`Total STUDENT users: ${students.length}`);
    console.log(`STUDENT users lacking studentId: ${nullStudents.length}`);
    console.log(`Duplicate studentId values among STUDENTS: ${duplicates.length}`);
    console.log(`FACULTY/ADMIN users with non-null studentId: ${nonStudentWithId.length}`);

    if (nullStudents.length === 0 && duplicates.length === 0 && nonStudentWithId.length === 0) {
      console.log('\n🚀 DATABASE PRE-MIGRATION STATE IS 100% VALID & READY!');
    } else {
      console.error('\n❌ DATABASE PRE-MIGRATION STATE HAS ISSUES!');
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

backfillStudentIds().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
