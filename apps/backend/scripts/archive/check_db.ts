import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const faculty = await prisma.facultyProfile.count();
  const departments = await prisma.department.count();
  const subjects = await prisma.subject.count();
  const resources = await prisma.resource.count();
  const projects = await prisma.project.count();

  console.log('Database inspection counts:');
  console.log({ users, faculty, departments, subjects, resources, projects });

  const resourceList = await prisma.resource.findMany();
  console.log('Existing resources:', JSON.stringify(resourceList, null, 2));

  const deptList = await prisma.department.findMany({ include: { subjects: true } });
  console.log('Existing departments & subjects:', JSON.stringify(deptList, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
