import { Test, TestingModule } from '@nestjs/testing';
import { MentorRecommendationController } from './mentor-recommendation.controller';
import { MentorRecommendationService } from './mentor-recommendation.service';

describe('MentorRecommendationController', () => {
  let controller: MentorRecommendationController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MentorRecommendationController],
      providers: [{ provide: MentorRecommendationService, useValue: {} }],
    }).compile();

    controller = module.get<MentorRecommendationController>(MentorRecommendationController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
