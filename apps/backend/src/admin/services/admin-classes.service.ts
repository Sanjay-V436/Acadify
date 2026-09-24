import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClassDto, UpdateClassDto, FilterClassDto, parsePagination, buildPaginatedResponse } from '../dto/admin.dto';

@Injectable()
export class AdminClassesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateClassDto) {
    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });
    if (!department) {
      throw new NotFoundException(`Department with ID ${dto.departmentId} not found`);
    }

    const section = dto.section?.trim() || null;
    const batchYear = Number(dto.batchYear);
    const currentSemester = dto.currentSemester ? Number(dto.currentSemester) : 1;

    const existing = section
      ? await this.prisma.class.findUnique({
          where: {
            departmentId_batchYear_section: {
              departmentId: dto.departmentId,
              batchYear,
              section,
            },
          },
        })
      : await this.prisma.class.findFirst({
          where: {
            departmentId: dto.departmentId,
            batchYear,
            section: null,
          },
        });

    if (existing) {
      throw new ConflictException(
        `Class for Department ${department.code}, Batch ${batchYear}, Section ${section || 'None'} already exists`,
      );
    }

    return this.prisma.class.create({
      data: {
        departmentId: dto.departmentId,
        batchYear,
        section,
        currentSemester,
      },
      include: {
        department: true,
        _count: {
          select: { students: true, teachingAssignments: true },
        },
      },
    });
  }

  async findAll(query: FilterClassDto) {
    const { page, limit, skip } = parsePagination(query);
    const where: any = {};

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }
    if (query.batchYear) {
      where.batchYear = Number(query.batchYear);
    }
    if (query.section !== undefined && query.section !== null && query.section !== '') {
      where.section = query.section;
    }
    if (query.currentSemester) {
      where.currentSemester = Number(query.currentSemester);
    }

    const [data, total] = await Promise.all([
      this.prisma.class.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ batchYear: 'desc' }, { department: { name: 'asc' } }],
        include: {
          department: true,
          _count: {
            select: { students: true, teachingAssignments: true },
          },
        },
      }),
      this.prisma.class.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const cls = await this.prisma.class.findUnique({
      where: { id },
      include: {
        department: true,
        students: {
          select: {
            id: true,
            name: true,
            email: true,
            studentId: true,
          },
        },
        teachingAssignments: {
          include: {
            subject: true,
            faculty: {
              include: {
                user: true,
              },
            },
          },
        },
        _count: {
          select: { students: true, teachingAssignments: true },
        },
      },
    });

    if (!cls) {
      throw new NotFoundException(`Class with ID ${id} not found`);
    }

    return cls;
  }

  async update(id: string, dto: UpdateClassDto) {
    await this.findOne(id);

    const data: any = {};
    if (dto.departmentId) data.departmentId = dto.departmentId;
    if (dto.batchYear !== undefined) data.batchYear = Number(dto.batchYear);
    if (dto.section !== undefined) data.section = dto.section?.trim() || null;
    if (dto.currentSemester !== undefined) data.currentSemester = Number(dto.currentSemester);

    return this.prisma.class.update({
      where: { id },
      data,
      include: {
        department: true,
        _count: {
          select: { students: true, teachingAssignments: true },
        },
      },
    });
  }

  async remove(id: string) {
    await this.findOne(id);

    // Set user classId to null for students in this class
    await this.prisma.user.updateMany({
      where: { classId: id },
      data: { classId: null },
    });

    // Delete teaching assignments first
    await this.prisma.teachingAssignment.deleteMany({
      where: { classId: id },
    });

    await this.prisma.class.delete({
      where: { id },
    });

    return { success: true };
  }
}
