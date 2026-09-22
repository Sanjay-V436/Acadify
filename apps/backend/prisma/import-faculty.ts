import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

interface FacultyRow {
  name: string;
  email: string;
  designation: string;
  department: string;
  qualification: string;
  researchInterests: string;
  orcid: string;
  profileUrl: string;
}

const TEMP_PASSWORD = 'Amrita@2026'; // faculty will reset this later via forgot-password

async function main() {
  const csvPath = path.join(__dirname, 'faculty_export.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');

  const rows: FacultyRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
  });

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
  const mapping: {
    name: string;
    email: string;
    facultyProfileId: string;
  }[] = [];

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    // Skip blank/malformed rows (scraping artifacts)
    if (!row.name?.trim() || !row.email?.trim()) {
      skipped++;
      continue;
    }

    const email = row.email.trim().toLowerCase();
    const name = row.name.trim();

    // Clean designation - take it as-is, it's just descriptive text
    const designation = row.designation?.trim() || null;

    // Split comma-separated research interests into an array, trim each
    const researchInterests = row.researchInterests
      ? row.researchInterests
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    try {
      const user = await prisma.user.upsert({
        where: { email },
        update: { name },
        create: {
          email,
          passwordHash,
          name,
          role: Role.FACULTY,
          // departmentId intentionally left unset - admin assigns manually
        },
      });

      const facultyProfile = await prisma.facultyProfile.upsert({
        where: { userId: user.id },
        update: {
          designation,
          qualification: row.qualification?.trim() || null,
          researchInterests,
          facultyWebpageUrl: row.profileUrl?.trim() || null,
          orcidUrl: row.orcid?.trim() || null,
        },
        create: {
          userId: user.id,
          designation,
          qualification: row.qualification?.trim() || null,
          researchInterests,
          facultyWebpageUrl: row.profileUrl?.trim() || null,
          orcidUrl: row.orcid?.trim() || null,
          availableForProjects: true,
          maxStudents: 4,
          currentStudents: 0,
        },
      });

      mapping.push({ name, email, facultyProfileId: facultyProfile.id });
      imported++;
    } catch (err) {
      console.error(`Failed to import ${email}:`, err);
      skipped++;
    }
  }

  // Write the ID mapping file for Person A to re-seed ChromaDB with real UUIDs
  const mappingCsv = [
    'name,email,facultyProfileId',
    ...mapping.map((m) => `"${m.name}",${m.email},${m.facultyProfileId}`),
  ].join('\n');

  fs.writeFileSync(path.join(__dirname, 'faculty-id-mapping.csv'), mappingCsv);

  console.log(`Imported: ${imported}, Skipped: ${skipped}`);
  console.log('Mapping written to prisma/faculty-id-mapping.csv');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
