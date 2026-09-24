import {
  Body,
  Controller,
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
import { AdminFacultyService } from '../services/admin-faculty.service';
import type {
  CreateFacultyDto,
  UpdateFacultyDto,
  FilterFacultyDto,
} from '../dto/admin.dto';

@Controller('admin/faculty')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminFacultyController {
  constructor(private readonly service: AdminFacultyService) {}

  @Post()
  create(@Body() body: CreateFacultyDto) {
    return this.service.create(body);
  }

  @Get()
  findAll(@Query() query: FilterFacultyDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateFacultyDto) {
    return this.service.update(id, body);
  }
}
