import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { AdminSubjectsService } from '../services/admin-subjects.service';
import type {
  CreateSubjectDto,
  UpdateSubjectDto,
  FilterSubjectDto,
} from '../dto/admin.dto';

@Controller('admin/subjects')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminSubjectsController {
  constructor(private readonly service: AdminSubjectsService) {}

  @Post()
  create(@Body() body: CreateSubjectDto) {
    return this.service.create(body);
  }

  @Get()
  findAll(@Query() query: FilterSubjectDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateSubjectDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
