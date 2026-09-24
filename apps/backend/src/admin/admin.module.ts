import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfilesModule } from '../profiles/profiles.module';

import { AdminClassesController } from './controllers/admin-classes.controller';
import { AdminDepartmentsController } from './controllers/admin-departments.controller';
import { AdminFacultyController } from './controllers/admin-faculty.controller';
import { AdminStudentsController } from './controllers/admin-students.controller';
import { AdminSubjectsController } from './controllers/admin-subjects.controller';
import { AdminTeachingAssignmentsController } from './controllers/admin-teaching-assignments.controller';

import { AdminClassesService } from './services/admin-classes.service';
import { AdminDepartmentsService } from './services/admin-departments.service';
import { AdminFacultyService } from './services/admin-faculty.service';
import { AdminStudentsService } from './services/admin-students.service';
import { AdminSubjectsService } from './services/admin-subjects.service';
import { AdminTeachingAssignmentsService } from './services/admin-teaching-assignments.service';

@Module({
  imports: [PrismaModule, ProfilesModule],
  controllers: [
    AdminClassesController,
    AdminDepartmentsController,
    AdminFacultyController,
    AdminStudentsController,
    AdminSubjectsController,
    AdminTeachingAssignmentsController,
  ],
  providers: [
    AdminClassesService,
    AdminDepartmentsService,
    AdminFacultyService,
    AdminStudentsService,
    AdminSubjectsService,
    AdminTeachingAssignmentsService,
  ],
  exports: [
    AdminClassesService,
    AdminDepartmentsService,
    AdminFacultyService,
    AdminStudentsService,
    AdminSubjectsService,
    AdminTeachingAssignmentsService,
  ],
})
export class AdminModule {}
