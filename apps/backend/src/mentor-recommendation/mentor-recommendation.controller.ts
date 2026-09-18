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
    @Body() body: { project_title: string; description?: string },
  ) {
    return this.mentorRecommendationService.getRecommendations(
      body.project_title,
      body.description,
    );
  }
}
