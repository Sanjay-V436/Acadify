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
  recommendations?: AIMentor[];
  ai_analysis_available?: boolean;
}

interface MentorRecommendationRequest {
  project_title?: string;
  title?: string;
  projectTitle?: string;
  description?: string;
  top_k?: number;
  topK?: number;
}

@Injectable()
export class MentorRecommendationService {
  constructor(private prisma: PrismaService) {}

  async getRecommendations(dto: MentorRecommendationRequest) {
    const aiBaseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    const title =
      dto.project_title?.trim() ||
      dto.title?.trim() ||
      dto.description?.substring(0, 50) ||
      'Academic Project';

    const payload = {
      project_title: title,
      description: dto.description || '',
      top_k: Number(dto.top_k || 5),
    };

    let response: Response;
    try {
      console.log('Mentor recommendation payload:', payload);
      response = await fetch(`${aiBaseUrl}/ai/mentor-recommendation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    const aiMentors: AIMentor[] =
      aiData.recommendations ?? aiData.mentors ?? [];

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

      return {
        mentors: enrichedMentors,
        recommendations: enrichedMentors,
        ai_analysis_available: aiData.ai_analysis_available ?? false,
      };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Database query failed';
      throw new InternalServerErrorException(
        `Failed to enrich mentor recommendations: ${message}`,
      );
    }
  }
}
