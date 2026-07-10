import { PrismaClient, Role, ProjectStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // 1. Departments
  const cse = await prisma.department.upsert({
    where: { code: 'CSE' },
    update: { name: 'Computer Science Engineering' },
    create: { name: 'Computer Science Engineering', code: 'CSE' },
  });

  const ece = await prisma.department.upsert({
    where: { code: 'ECE' },
    update: { name: 'Electronics and Communication Engineering' },
    create: { name: 'Electronics and Communication Engineering', code: 'ECE' },
  });

  // 2. Subjects
  await prisma.subject.createMany({
    data: [
      {
        name: 'Data Structures',
        code: 'CSE201',
        semester: 3,
        departmentId: cse.id,
      },
      {
        name: 'Database Management Systems',
        code: 'CSE301',
        semester: 5,
        departmentId: cse.id,
      },
      {
        name: 'Digital Electronics',
        code: 'ECE201',
        semester: 3,
        departmentId: ece.id,
      },
    ],
    skipDuplicates: true,
  });

  // 3. Users - hash a dummy password for all seeded users
  const passwordHash = bcrypt.hashSync('Test@1234', 10);

  await prisma.user.upsert({
    where: { email: 'p_devisowjanya@ch.amrita.edu' },
    update: {
      passwordHash,
      name: 'Dr. Devi Sowjanya',
      role: Role.ADMIN,
    },
    create: {
      email: 'p_devisowjanya@ch.amrita.edu',
      passwordHash,
      name: 'Dr. Devi Sowjanya',
      role: Role.ADMIN,
    },
  });

  const facultyUser = await prisma.user.upsert({
    where: { email: 'p_priyasharma@ch.amrita.edu' },
    update: {
      passwordHash,
      name: 'Dr. Priya Sharma',
      role: Role.FACULTY,
      departmentId: cse.id,
    },
    create: {
      email: 'p_priyasharma@ch.amrita.edu',
      passwordHash,
      name: 'Dr. Priya Sharma',
      role: Role.FACULTY,
      departmentId: cse.id,
    },
  });

  const studentUser = await prisma.user.upsert({
    where: { email: 'ch.en.u4cce23041@ch.students.amrita.edu' },
    update: {
      passwordHash,
      name: 'Arjun Kumar',
      role: Role.STUDENT,
      departmentId: cse.id,
      currentSemester: 5,
    },
    create: {
      email: 'ch.en.u4cce23041@ch.students.amrita.edu',
      passwordHash,
      name: 'Arjun Kumar',
      role: Role.STUDENT,
      departmentId: cse.id,
      currentSemester: 5,
    },
  });

  // 4. Faculty Profile
  const facultyProfile = await prisma.facultyProfile.upsert({
    where: { userId: facultyUser.id },
    update: {
      designation: 'Associate Professor',
      researchInterests: ['Machine Learning', 'IoT', 'Smart Systems'],
      currentResearch: 'Edge AI for agricultural sensing',
      skills: ['Python', 'TensorFlow', 'Embedded Systems'],
      specialization: 'AI and IoT',
      availableForProjects: true,
      maxStudents: 4,
      currentStudents: 0,
    },
    create: {
      userId: facultyUser.id,
      designation: 'Associate Professor',
      researchInterests: ['Machine Learning', 'IoT', 'Smart Systems'],
      currentResearch: 'Edge AI for agricultural sensing',
      skills: ['Python', 'TensorFlow', 'Embedded Systems'],
      specialization: 'AI and IoT',
      availableForProjects: true,
      maxStudents: 4,
      currentStudents: 0,
    },
  });

  // 5. A sample project
  let project = await prisma.project.findFirst({
    where: { title: 'AI Based Smart Irrigation using IoT' },
  });

  if (!project) {
    project = await prisma.project.create({
      data: {
        title: 'AI Based Smart Irrigation using IoT',
        description:
          'A soil-sensor-driven irrigation system with ML-based watering predictions',
        technologies: ['Python', 'IoT', 'TensorFlow'],
        domain: 'Machine Learning',
        status: ProjectStatus.PROPOSED,
        mentorId: facultyProfile.id,
      },
    });
  }

  await prisma.projectStudent.createMany({
    data: [
      {
        projectId: project.id,
        userId: studentUser.id,
      },
    ],
    skipDuplicates: true,
  });

  console.log('Seed data created successfully');
}

main()
  .catch((e: unknown) => {
    if (e instanceof Error) {
      console.error(e);
    } else {
      console.error('Unknown error', e);
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
