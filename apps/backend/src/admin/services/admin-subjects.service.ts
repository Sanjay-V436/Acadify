import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateSubjectDto,
  UpdateSubjectDto,
  FilterSubjectDto,
  parsePagination,
  buildPaginatedResponse,
} from '../dto/admin.dto';

@Injectable()
export class AdminSubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateSubjectDto) {
    if (!dto.name || !dto.code || !dto.departmentId || dto.semester === undefined) {
      throw new BadRequestException('name, code, semester, and departmentId are required');
    }

    const semester = Number(dto.semester);
    if (!Number.isInteger(semester) || semester < 1) {
      throw new BadRequestException('semester must be a positive integer');
    }

    const codeUpper = dto.code.trim().toUpperCase();
    const existingCode = await this.prisma.subject.findUnique({
      where: { code: codeUpper },
    });
    if (existingCode) {
      throw new ConflictException(`Subject with code "${codeUpper}" already exists`);
    }

    const department = await this.prisma.department.findUnique({
      where: { id: dto.departmentId },
    });
    if (!department) {
      throw new NotFoundException(`Department with ID "${dto.departmentId}" not found`);
    }

    return this.prisma.subject.create({
      data: {
        name: dto.name.trim(),
        code: codeUpper,
        semester,
        departmentId: dto.departmentId,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async findAll(query: FilterSubjectDto) {
    const { page, limit, skip } = parsePagination(query);

    const where: Record<string, unknown> = {};

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }
    if (query.semester !== undefined && query.semester !== '') {
      where.semester = Number(query.semester);
    }
    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.subject.findMany({
        where,
        skip,
        take: limit,
        include: {
          department: { select: { id: true, name: true, code: true } },
        },
        orderBy: [{ code: 'asc' }],
      }),
      this.prisma.subject.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const subject = await this.prisma.subject.findUnique({
      where: { id },
      include: {
        department: true,
        teachingAssignments: {
          include: {
            class: true,
            faculty: { include: { user: true } },
          },
        },
      },
    });

    if (!subject) {
      throw new NotFoundException(`Subject with ID "${id}" not found`);
    }

    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto) {
    const existing = await this.findOne(id);

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined && dto.name.trim() !== existing.name) {
      updateData.name = dto.name.trim();
    }

    if (dto.code !== undefined && dto.code.trim().toUpperCase() !== existing.code) {
      const codeUpper = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.subject.findUnique({
        where: { code: codeUpper },
      });
      if (duplicate) {
        throw new ConflictException(`Subject with code "${codeUpper}" already exists`);
      }
      updateData.code = codeUpper;
    }

    if (dto.semester !== undefined) {
      const semester = Number(dto.semester);
      if (!Number.isInteger(semester) || semester < 1) {
        throw new BadRequestException('semester must be a positive integer');
      }
      updateData.semester = semester;
    }

    if (dto.departmentId !== undefined && dto.departmentId !== existing.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept) {
        throw new NotFoundException(`Department with ID "${dto.departmentId}" not found`);
      }
      updateData.departmentId = dto.departmentId;
    }

    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    return this.prisma.subject.update({
      where: { id },
      data: updateData,
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async remove(id: string) {
    const existing = await this.findOne(id);

    // Delete teaching assignments first
    await this.prisma.teachingAssignment.deleteMany({
      where: { subjectId: id },
    });

    return this.prisma.subject.delete({
      where: { id },
    });
  }
}
