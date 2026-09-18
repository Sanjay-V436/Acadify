import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MentorRecommendationController } from './mentor-recommendation.controller';
import { MentorRecommendationService } from './mentor-recommendation.service';

@Module({
  imports: [PrismaModule],
  controllers: [MentorRecommendationController],
  providers: [MentorRecommendationService],
})
export class MentorRecommendationModule {}
