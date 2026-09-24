import { PrismaClient, Role } from '@prisma/client';

async function inspectStudentIds() {
  const prisma = new PrismaClient();
  try {
    console.log('=== DATABASE USER & STUDENT_ID AUDIT ===\n');

    const totalUsers = await prisma.user.count();
    const students = await prisma.user.findMany({ where: { role: Role.STUDENT } });
    const faculty = await prisma.user.findMany({ where: { role: Role.FACULTY } });
    const admins = await prisma.user.findMany({ where: { role: Role.ADMIN } });

    console.log(`Total Users in DB: ${totalUsers}`);
    console.log(`- STUDENT users: ${students.length}`);
    console.log(`- FACULTY users: ${faculty.length}`);
    console.log(`- ADMIN users: ${admins.length}\n`);

    const studentsWithId = students.filter((s) => s.studentId && s.studentId.trim() !== '');
    const studentsWithoutId = students.filter((s) => !s.studentId || s.studentId.trim() === '');

    console.log(`=== STUDENT AUDIT ===`);
    console.log(`Students WITH studentId: ${studentsWithId.length}`);
    console.log(`Students WITHOUT studentId: ${studentsWithoutId.length}`);

    if (studentsWithoutId.length > 0) {
      console.log('\nStudents lacking studentId:');
      studentsWithoutId.forEach((s, idx) => {
        console.log(`  ${idx + 1}. ID: ${s.id} | Name: ${s.name} | Email: ${s.email}`);
      });
    }

    // Check duplicate studentId among students
    const idCounts: Record<string, number> = {};
    studentsWithId.forEach((s) => {
      const id = s.studentId!.trim();
      idCounts[id] = (idCounts[id] || 0) + 1;
    });

    const duplicateStudentIds = Object.entries(idCounts).filter(([_, count]) => count > 1);
    if (duplicateStudentIds.length > 0) {
      console.log('\nDUPLICATE studentIds found among STUDENT users:');
      duplicateStudentIds.forEach(([id, count]) => {
        console.log(`  - studentId "${id}": ${count} occurrences`);
      });
    } else {
      console.log('No duplicate studentIds found among STUDENT users.');
    }

    // Check FACULTY and ADMIN studentId usage
    const facultyWithId = faculty.filter((f) => f.studentId && f.studentId.trim() !== '');
    const adminsWithId = admins.filter((a) => a.studentId && a.studentId.trim() !== '');

    console.log(`\n=== FACULTY & ADMIN AUDIT ===`);
    console.log(`FACULTY with non-null studentId: ${facultyWithId.length}`);
    if (facultyWithId.length > 0) {
      facultyWithId.forEach((f) => console.log(`  - ID: ${f.id} | Name: ${f.name} | Email: ${f.email} | studentId: ${f.studentId}`));
    }

    console.log(`ADMIN with non-null studentId: ${adminsWithId.length}`);
    if (adminsWithId.length > 0) {
      adminsWithId.forEach((a) => console.log(`  - ID: ${a.id} | Name: ${a.name} | Email: ${a.email} | studentId: ${a.studentId}`));
    }

  } finally {
    await prisma.$disconnect();
  }
}

inspectStudentIds().catch(console.error);
