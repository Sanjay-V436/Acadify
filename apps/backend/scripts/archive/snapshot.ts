import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true }, orderBy: { id: 'asc' } });
  const faculty = await prisma.facultyProfile.findMany({ select: { id: true, userId: true }, orderBy: { id: 'asc' } });
  const departments = await prisma.department.findMany({ select: { id: true, code: true, name: true }, orderBy: { id: 'asc' } });
  const subjects = await prisma.subject.findMany({ select: { id: true, code: true, name: true }, orderBy: { id: 'asc' } });
  const projects = await prisma.project.findMany({ select: { id: true, title: true }, orderBy: { id: 'asc' } });
  const projectStudents = await prisma.projectStudent.findMany({ select: { id: true, projectId: true, userId: true }, orderBy: { id: 'asc' } });
  const resources = await prisma.resource.findMany();

  const snapshotData = {
    timestamp: new Date().toISOString(),
    counts: {
      users: users.length,
      faculty: faculty.length,
      departments: departments.length,
      subjects: subjects.length,
      projects: projects.length,
      projectStudents: projectStudents.length,
      resources: resources.length,
    },
    users,
    faculty,
    departments,
    subjects,
    projects,
    projectStudents,
    resources,
  };

  const snapshotPath = path.join(__dirname, 'pre_migration_snapshot.json');
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, 2), 'utf-8');

  console.log('--- PRE-MIGRATION SNAPSHOT RECORDED ---');
  console.log('Counts:', snapshotData.counts);
  console.log('Resource records details:', resources);
  console.log('Snapshot written to:', snapshotPath);
}

main().catch(console.error).finally(() => prisma.$disconnect());
