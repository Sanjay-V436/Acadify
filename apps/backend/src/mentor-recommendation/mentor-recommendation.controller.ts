import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MentorRecommendationService } from './mentor-recommendation.service';

@Controller('mentor-recommendation')
@UseGuards(JwtAuthGuard)
export class MentorRecommendationController {
  constructor(
    private readonly mentorRecommendationService: MentorRecommendationService,
  ) {}

  @Post()
  async getRecommendations(
    @Body()
    body: {
      project_title?: string;
      title?: string;
      projectTitle?: string;
      description?: string;
      top_k?: number;
      topK?: number;
    },
  ) {
    return this.mentorRecommendationService.getRecommendations(body);
  }
}
