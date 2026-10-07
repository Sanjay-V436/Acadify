import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import * as bcrypt from 'bcrypt';
import { PrismaClient, Role, Department } from '@prisma/client';

const prisma = new PrismaClient();

interface FacultyCsvRow {
  name: string;
  department: string;
  designation: string;
  qualification: string;
  research_interests: string;
  publications: string;
  email: string;
  orcid: string;
  profile_url: string;
}

const TEMP_PASSWORD = 'Amrita@2026';

/**
 * Safely match CSV department string against existing Department records in DB.
 * Exact string match or canonical exact prefix match only. NO fuzzy matching.
 */
function findSafeDepartmentMatch(
  csvDeptRaw: string,
  departments: Department[],
): Department | null {
  if (!csvDeptRaw || !csvDeptRaw.trim()) return null;
  const cleaned = csvDeptRaw.trim();

  // 1. Direct exact match on name or code (case-insensitive)
  const exact = departments.find(
    (d) =>
      d.name.toLowerCase() === cleaned.toLowerCase() ||
      d.code.toLowerCase() === cleaned.toLowerCase(),
  );
  if (exact) return exact;

  // 2. Canonical exact prefix match: e.g. "Department of <name>..."
  for (const dept of departments) {
    const prefix = `department of ${dept.name.toLowerCase()}`;
    if (cleaned.toLowerCase().startsWith(prefix)) {
      return dept;
    }
  }

  return null;
}

/**
 * Extract primary designation from pipe-separated designation string.
 * e.g. "Chairperson | Professor | Associate Professor" -> "Chairperson"
 */
function getPrimaryDesignation(rawDesignation?: string): string | null {
  if (!rawDesignation || !rawDesignation.trim()) return null;
  const parts = rawDesignation
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts[0] : null;
}

/**
 * Parse comma-separated research interests into clean String[].
 */
function parseResearchInterests(raw?: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Parse pipe-separated (" | ") publications into clean String[].
 */
function parsePublications(raw?: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const datasetPath = path.join(__dirname, 'faculty_dataset.csv');
  const fallbackPath = path.join(__dirname, 'faculty_export.csv');
  const csvPath = fs.existsSync(datasetPath) ? datasetPath : fallbackPath;

  console.log(`Loading faculty CSV from: ${csvPath}`);
  const fileContent = fs.readFileSync(csvPath, 'utf-8');

  const rows: FacultyCsvRow[] = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    bom: true, // Automatically strip UTF-8 BOM if present
  });

  console.log(`Total rows read from CSV: ${rows.length}`);

  // Fetch all existing departments for deterministic matching
  const existingDepartments = await prisma.department.findMany();
  console.log(
    `Loaded ${existingDepartments.length} departments from DB for matching:`,
    existingDepartments.map((d) => `${d.code} (${d.name})`).join(', '),
  );

  const passwordHash = await bcrypt.hash(TEMP_PASSWORD, 10);
  const mapping: {
    name: string;
    email: string;
    facultyProfileId: string;
  }[] = [];

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  const unmatchedDepartments = new Set<string>();
  const noEmailRows: FacultyCsvRow[] = [];

  for (const row of rows) {
    const rawName = (row.name || '').trim();
    const rawEmail = (row.email || '').trim().toLowerCase();

    if (!rawName) {
      console.warn('Skipping row without name');
      skipped++;
      continue;
    }

    const designation = getPrimaryDesignation(row.designation);
    const qualification = row.qualification?.trim() || null;
    const researchInterests = parseResearchInterests(row.research_interests);
    const publications = parsePublications(row.publications);
    const facultyWebpageUrl = row.profile_url?.trim() || null;
    const orcidUrl = row.orcid?.trim() || null;

    // Department safe exact match
    const matchedDept = findSafeDepartmentMatch(
      row.department,
      existingDepartments,
    );
    if (!matchedDept && row.department?.trim()) {
      unmatchedDepartments.add(row.department.trim());
    }

    // Faculty WITH email: standard upsert
    if (rawEmail) {
      try {
        const existingUser = await prisma.user.findUnique({
          where: { email: rawEmail },
          include: { facultyProfile: true },
        });

        let facultyProfileId: string;

        if (existingUser) {
          // Update User (do not overwrite departmentId if CSV had no safe match and user already has one)
          await prisma.user.update({
            where: { id: existingUser.id },
            data: {
              name: rawName,
              ...(matchedDept ? { departmentId: matchedDept.id } : {}),
            },
          });

          // Upsert FacultyProfile: DO NOT overwrite manual availability settings
          const profile = await prisma.facultyProfile.upsert({
            where: { userId: existingUser.id },
            update: {
              designation,
              qualification,
              researchInterests,
              publications,
              facultyWebpageUrl,
              orcidUrl,
            },
            create: {
              userId: existingUser.id,
              designation,
              qualification,
              researchInterests,
              publications,
              facultyWebpageUrl,
              orcidUrl,
              availableForProjects: true,
              maxStudents: 5,
              currentStudents: 0,
            },
          });

          facultyProfileId = profile.id;
          updated++;
        } else {
          // Create new user and profile
          const user = await prisma.user.create({
            data: {
              email: rawEmail,
              passwordHash,
              name: rawName,
              role: Role.FACULTY,
              departmentId: matchedDept ? matchedDept.id : null,
              facultyProfile: {
                create: {
                  designation,
                  qualification,
                  researchInterests,
                  publications,
                  facultyWebpageUrl,
                  orcidUrl,
                  availableForProjects: true,
                  maxStudents: 5,
                  currentStudents: 0,
                },
              },
            },
            include: { facultyProfile: true },
          });

          facultyProfileId = user.facultyProfile!.id;
          imported++;
        }

        mapping.push({
          name: rawName,
          email: rawEmail,
          facultyProfileId,
        });
      } catch (err) {
        console.error(`Failed to import faculty with email ${rawEmail}:`, err);
        skipped++;
      }
    } else {
      // Faculty WITHOUT email: Recommendation-only faculty
      noEmailRows.push(row);

      // Check if this faculty member already exists in DB (e.g. matched by webpage URL or name)
      try {
        let existingProfile = facultyWebpageUrl
          ? await prisma.facultyProfile.findFirst({
              where: { facultyWebpageUrl },
              include: { user: true },
            })
          : null;

        if (!existingProfile) {
          existingProfile = await prisma.facultyProfile.findFirst({
            where: { user: { name: rawName } },
            include: { user: true },
          });
        }

        if (existingProfile) {
          // Update existing profile without overwriting availability or touching auth
          const updatedProfile = await prisma.facultyProfile.update({
            where: { id: existingProfile.id },
            data: {
              designation,
              qualification,
              researchInterests,
              publications,
              facultyWebpageUrl,
              orcidUrl,
            },
          });

          mapping.push({
            name: rawName,
            email: '',
            facultyProfileId: updatedProfile.id,
          });
          updated++;
        } else {
          // New faculty without email:
          // In the current Prisma schema, User.email is NOT NULL (@unique) and FacultyProfile.userId is NOT NULL.
          // In accordance with instructions: Do not invent email addresses or fake login credentials.
          // Staged and reported for the schema migration decision.
          console.log(
            `[NO-EMAIL FACULTY DETECTED] "${rawName}" - staged for recommendation. Awaiting nullable email schema update.`,
          );
        }
      } catch (err) {
        console.error(`Failed to process no-email faculty "${rawName}":`, err);
      }
    }
  }

  // Write the ID mapping file (used by AI service to seed ChromaDB with real UUIDs)
  const mappingCsv = [
    'name,email,facultyProfileId',
    ...mapping.map((m) => `"${m.name}",${m.email},${m.facultyProfileId}`),
  ].join('\n');

  fs.writeFileSync(path.join(__dirname, 'faculty-id-mapping.csv'), mappingCsv);

  console.log('\n--- IMPORT SUMMARY ---');
  console.log(`With Email Processed: ${imported + updated} (New: ${imported}, Updated: ${updated})`);
  console.log(`No-Email Faculty Tracked: ${noEmailRows.length}`);
  console.log(`Skipped / Errors: ${skipped}`);
  console.log(`Mapping records written: ${mapping.length} -> prisma/faculty-id-mapping.csv`);

  if (unmatchedDepartments.size > 0) {
    console.log('\nUnmatched department strings (safely left null/unchanged):');
    Array.from(unmatchedDepartments).forEach((d) => {
      console.log(`  - "${d}"`);
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
