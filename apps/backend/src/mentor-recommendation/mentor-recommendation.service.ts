import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface AIMentor {
  faculty_id: string;
  name?: string;
  confidence_score?: number;
  reasoning?: string;
  [key: string]: unknown;
}

interface AIServiceResponse {
  mentors?: AIMentor[];
}

@Injectable()
export class MentorRecommendationService {
  constructor(private prisma: PrismaService) {}

  async getRecommendations(projectTitle: string, description?: string) {
    const aiBaseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';

    let response: Response;
    try {
      response = await fetch(`${aiBaseUrl}/ai/mentor-recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_title: projectTitle,
          description: description || '',
        }),
      });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Service unreachable';
      throw new BadGatewayException(
        `AI microservice is offline or unreachable: ${message}`,
      );
    }

    if (!response.ok) {
      throw new BadGatewayException(
        `AI service returned status error ${response.status}`,
      );
    }

    const aiData = (await response.json()) as AIServiceResponse;
    const aiMentors: AIMentor[] = aiData.mentors || [];

    // Extract returned UUIDs (from faculty-id-mapping re-seeded ChromaDB)
    const facultyIds = aiMentors.map((m) => m.faculty_id);

    try {
      // Corrected relation: FacultyProfile -> User -> Department
      const profiles = await this.prisma.facultyProfile.findMany({
        where: { id: { in: facultyIds } },
        include: {
          user: {
            include: {
              department: true,
            },
          },
        },
      });

      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      const enrichedMentors = aiMentors.map((mentor) => {
        const dbProfile = profileMap.get(mentor.faculty_id);
        const maxStudents = dbProfile?.maxStudents ?? 0;
        const currentStudents = dbProfile?.currentStudents ?? 0;

        return {
          ...mentor,
          department: dbProfile?.user?.department?.name ?? 'N/A',
          maxStudents,
          currentStudents,
          availableSlots: Math.max(0, maxStudents - currentStudents),
        };
      });

      return { mentors: enrichedMentors };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Database query failed';
      throw new InternalServerErrorException(
        `Failed to enrich mentor recommendations: ${message}`,
      );
    }
  }
}
