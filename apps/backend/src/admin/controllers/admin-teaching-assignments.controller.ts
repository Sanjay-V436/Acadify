import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AdminTeachingAssignmentsService } from '../services/admin-teaching-assignments.service';
import type { AssignFacultyDto } from '../dto/admin.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminTeachingAssignmentsController {
  constructor(private readonly service: AdminTeachingAssignmentsService) {}

  @Post('teaching-assignments')
  upsertAssignment(@Body() body: AssignFacultyDto) {
    return this.service.upsertAssignment(body);
  }

  @Get('teaching-assignments')
  findAll(@Query('classId') classId?: string) {
    return this.service.findAll(classId);
  }

  @Get('classes/:classId/teaching-assignments')
  getAssignmentsByClass(@Param('classId') classId: string) {
    return this.service.getAssignmentsByClass(classId);
  }

  @Delete('teaching-assignments/:id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
