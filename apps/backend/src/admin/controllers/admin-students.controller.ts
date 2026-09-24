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
import { AdminStudentsService } from '../services/admin-students.service';
import type {
  CreateStudentDto,
  UpdateStudentDto,
  FilterStudentDto,
  BulkImportStudentsDto,
} from '../dto/admin.dto';

@Controller('admin/students')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminStudentsController {
  constructor(private readonly service: AdminStudentsService) {}

  @Post('import')
  importBulk(@Body() body: BulkImportStudentsDto) {
    return this.service.importStudentsBulk(body);
  }

  @Post()
  create(@Body() body: CreateStudentDto) {
    return this.service.create(body);
  }

  @Get()
  findAll(@Query() query: FilterStudentDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateStudentDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
