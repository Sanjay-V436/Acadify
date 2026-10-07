import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProjectsService } from './projects.service';
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from './projects.service';

type AuthenticatedRequest = Request & {
  user: { userId: string };
};

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get('community')
  @Roles(Role.STUDENT, Role.FACULTY, Role.ADMIN)
  findCommunity(
    @Query('search') search?: string,
    @Query('domain') domain?: string,
    @Query('tech') tech?: string,
    @Query('status') status?: string,
    @Query('departmentId') departmentId?: string,
    @Query('sort') sort?: string,
  ) {
    return this.projectsService.findCommunity({
      search,
      domain,
      tech,
      status,
      departmentId,
      sort,
    });
  }

  @Get('community/meta')
  @Roles(Role.STUDENT, Role.FACULTY, Role.ADMIN)
  getCommunityMetadata() {
    return this.projectsService.getCommunityMetadata();
  }

  @Get()
  @Roles(Role.STUDENT)
  findAll(@Req() request: AuthenticatedRequest) {
    return this.projectsService.findAllForStudent(request.user.userId);
  }

  @Get(':id')
  @Roles(Role.STUDENT, Role.FACULTY, Role.ADMIN)
  findOne(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.projectsService.findOneForStudent(id, request.user.userId);
  }

  @Post()
  @Roles(Role.STUDENT)
  create(
    @Req() request: AuthenticatedRequest,
    @Body() body: CreateProjectInput,
  ) {
    return this.projectsService.createForStudent(request.user.userId, body);
  }

  @Patch(':id/publish-toggle')
  @Roles(Role.STUDENT)
  togglePublish(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.projectsService.togglePublish(id, request.user.userId);
  }

  @Patch(':id')
  @Roles(Role.STUDENT)
  update(
    @Req() request: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateProjectInput,
  ) {
    return this.projectsService.updateForStudent(id, request.user.userId, body);
  }

  @Delete(':id')
  @Roles(Role.STUDENT)
  remove(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    return this.projectsService.removeForStudent(id, request.user.userId);
  }
}
