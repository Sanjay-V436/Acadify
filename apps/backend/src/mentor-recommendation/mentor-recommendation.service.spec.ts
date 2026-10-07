import { Test, TestingModule } from '@nestjs/testing';
import { MentorRecommendationService } from './mentor-recommendation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MentorRecommendationService', () => {
  let service: MentorRecommendationService;
  let prismaMock: { facultyProfile: { findMany: jest.Mock } };

  beforeEach(async () => {
    prismaMock = {
      facultyProfile: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentorRecommendationService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<MentorRecommendationService>(MentorRecommendationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should enrich DB-backed faculty from PostgreSQL and apply fallback defaults for no-email faculty', async () => {
    const aiResponse = {
      recommendations: [
        {
          faculty_id: 'db-faculty-1',
          name: 'Dr. DB Faculty',
          confidence_score: 0.85,
        },
        {
          faculty_id: 'noemail-faculty-2',
          name: 'Dr. No Email Faculty',
          department: 'Mechanical Engineering',
          qualifications: 'PhD in Robotics',
          max_students: 5,
          current_students: 0,
          confidence_score: 0.80,
        },
      ],
      ai_analysis_available: true,
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(aiResponse),
    } as any);

    prismaMock.facultyProfile.findMany.mockResolvedValue([
      {
        id: 'db-faculty-1',
        maxStudents: 4,
        currentStudents: 1,
        availableForProjects: true,
        qualification: 'PhD in ECE',
        user: {
          name: 'Dr. DB Faculty',
          department: { name: 'Electronics and Communication Engineering' },
        },
      },
    ]);

    const result = await service.getRecommendations({
      project_title: 'Smart IoT System',
      description: 'Robotics and embedded systems',
    });

    expect(result.recommendations).toHaveLength(2);

    // DB-backed faculty
    const dbMentor = result.recommendations[0];
    expect(dbMentor.faculty_id).toBe('db-faculty-1');
    expect(dbMentor.department).toBe('Electronics and Communication Engineering');
    expect(dbMentor.maxStudents).toBe(4);
    expect(dbMentor.currentStudents).toBe(1);
    expect(dbMentor.availableSlots).toBe(3);

    // No-email / non-DB faculty fallback
    const noEmailMentor = result.recommendations[1];
    expect(noEmailMentor.faculty_id).toBe('noemail-faculty-2');
    expect(noEmailMentor.department).toBe('Mechanical Engineering');
    expect(noEmailMentor.qualifications).toBe('PhD in Robotics');
    expect(noEmailMentor.maxStudents).toBe(5);
    expect(noEmailMentor.currentStudents).toBe(0);
    expect(noEmailMentor.availableSlots).toBe(5);
  });
});
