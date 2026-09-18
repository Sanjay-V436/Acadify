import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PrismaModule } from './prisma/prisma.module';
import { MentorRecommendationModule } from './mentor-recommendation/mentor-recommendation.module';
import { ProjectsModule } from './projects/projects.module';
@Module({
  imports: [
    AuthModule,
    UsersModule,
    PrismaModule,
    MentorRecommendationModule,
    ProjectsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
