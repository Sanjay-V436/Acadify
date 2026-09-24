import { PrismaClient } from '@prisma/client';

async function applyMigration() {
  const prisma = new PrismaClient();
  try {
    console.log('Applying UNIQUE INDEX "User_studentId_key" to PostgreSQL database...');
    await prisma.$executeRawUnsafe(
      'CREATE UNIQUE INDEX IF NOT EXISTS "User_studentId_key" ON "User"("studentId");',
    );
    console.log('✅ Unique index "User_studentId_key" created successfully!');
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration().catch((err) => {
  console.error('Failed to apply migration SQL:', err);
  process.exit(1);
});
