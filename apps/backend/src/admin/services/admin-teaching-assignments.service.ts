import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AssignFacultyDto } from '../dto/admin.dto';

@Injectable()
export class AdminTeachingAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async upsertAssignment(dto: AssignFacultyDto) {
    if (!dto.classId || !dto.subjectId || !dto.facultyId) {
      throw new BadRequestException('classId, subjectId, and facultyId are required');
    }

    const cls = await this.prisma.class.findUnique({
      where: { id: dto.classId },
    });
    if (!cls) {
      throw new NotFoundException(`Class with ID "${dto.classId}" not found`);
    }

    const subject = await this.prisma.subject.findUnique({
      where: { id: dto.subjectId },
    });
    if (!subject) {
      throw new NotFoundException(`Subject with ID "${dto.subjectId}" not found`);
    }

    // Resolve FacultyProfile ID
    const faculty = await this.prisma.facultyProfile.findFirst({
      where: {
        OR: [
          { id: dto.facultyId },
          { userId: dto.facultyId },
        ],
      },
    });
    if (!faculty) {
      throw new NotFoundException(`Faculty profile with ID "${dto.facultyId}" not found`);
    }

    return this.prisma.teachingAssignment.upsert({
      where: {
        classId_subjectId: {
          classId: dto.classId,
          subjectId: dto.subjectId,
        },
      },
      create: {
        classId: dto.classId,
        subjectId: dto.subjectId,
        facultyId: faculty.id,
      },
      update: {
        facultyId: faculty.id,
      },
      include: {
        class: { include: { department: true } },
        subject: true,
        faculty: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
  }

  async getAssignmentsByClass(classId: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id: classId },
      include: { department: true },
    });
    if (!cls) {
      throw new NotFoundException(`Class with ID "${classId}" not found`);
    }

    // List all subjects at that class's department and currentSemester
    const subjects = await this.prisma.subject.findMany({
      where: {
        departmentId: cls.departmentId,
        semester: cls.currentSemester,
      },
      orderBy: { name: 'asc' },
    });

    const existingAssignments = await this.prisma.teachingAssignment.findMany({
      where: { classId },
      include: {
        faculty: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    const assignmentMap = new Map(existingAssignments.map((a) => [a.subjectId, a]));

    return {
      class: cls,
      rows: subjects.map((subject) => {
        const assignment = assignmentMap.get(subject.id);
        return {
          subject,
          assignmentId: assignment?.id || null,
          assignedFacultyId: assignment?.facultyId || null,
          assignedFaculty: assignment?.faculty || null,
        };
      }),
    };
  }

  async findAll(classId?: string) {
    return this.prisma.teachingAssignment.findMany({
      where: classId ? { classId } : {},
      include: {
        class: { include: { department: true } },
        subject: true,
        faculty: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
      orderBy: { class: { batchYear: 'desc' } },
    });
  }

  async remove(id: string) {
    const assignment = await this.prisma.teachingAssignment.findUnique({
      where: { id },
    });
    if (!assignment) {
      throw new NotFoundException(`Teaching assignment with ID "${id}" not found`);
    }

    return this.prisma.teachingAssignment.delete({
      where: { id },
    });
  }
}
