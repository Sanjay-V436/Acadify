import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfilesService } from './profiles.service';
import type { UpdateProfileInput } from './profiles.service';

type AuthenticatedRequest = Request & {
  user: { userId: string; role: string };
};

@Controller('profiles')
@UseGuards(JwtAuthGuard)
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get('me')
  getMine(@Req() request: AuthenticatedRequest) {
    return this.profilesService.getMine(request.user.userId, request.user.role);
  }

  @Patch('me')
  updateMine(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateProfileInput,
  ) {
    return this.profilesService.updateMine(
      request.user.userId,
      request.user.role,
      body,
    );
  }
}
