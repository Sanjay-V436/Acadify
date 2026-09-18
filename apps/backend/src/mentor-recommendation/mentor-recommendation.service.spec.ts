import { Test, TestingModule } from '@nestjs/testing';
import { MentorRecommendationService } from './mentor-recommendation.service';
import { PrismaService } from '../prisma/prisma.service';

describe('MentorRecommendationService', () => {
  let service: MentorRecommendationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MentorRecommendationService,
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();

    service = module.get<MentorRecommendationService>(MentorRecommendationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
