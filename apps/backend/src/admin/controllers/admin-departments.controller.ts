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
import { AdminDepartmentsService } from '../services/admin-departments.service';
import type {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  PaginationQuery,
} from '../dto/admin.dto';

@Controller('admin/departments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminDepartmentsController {
  constructor(private readonly service: AdminDepartmentsService) {}

  @Post()
  create(@Body() body: CreateDepartmentDto) {
    return this.service.create(body);
  }

  @Get()
  findAll(@Query() query: PaginationQuery & { search?: string }) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateDepartmentDto) {
    return this.service.update(id, body);
  }
}
