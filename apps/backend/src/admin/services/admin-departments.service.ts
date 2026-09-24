import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  PaginationQuery,
  parsePagination,
  buildPaginatedResponse,
} from '../dto/admin.dto';

@Injectable()
export class AdminDepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateDepartmentDto) {
    if (!dto.name || !dto.code) {
      throw new BadRequestException('name and code are required');
    }

    const codeUpper = dto.code.trim().toUpperCase();
    const existing = await this.prisma.department.findUnique({
      where: { code: codeUpper },
    });
    if (existing) {
      throw new ConflictException(`Department with code "${codeUpper}" already exists`);
    }

    return this.prisma.department.create({
      data: {
        name: dto.name.trim(),
        code: codeUpper,
      },
    });
  }

  async findAll(query: PaginationQuery & { search?: string }) {
    const { page, limit, skip } = parsePagination(query);

    const where: Record<string, unknown> = {};
    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              students: true,
              classes: true,
              subjects: true,
            },
          },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.department.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        subjects: true,
        classes: true,
        _count: {
          select: {
            students: true,
            classes: true,
            subjects: true,
          },
        },
      },
    });

    if (!department) {
      throw new NotFoundException(`Department with ID "${id}" not found`);
    }

    return department;
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const existing = await this.findOne(id);

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined && dto.name.trim() !== existing.name) {
      updateData.name = dto.name.trim();
    }

    if (dto.code !== undefined && dto.code.trim().toUpperCase() !== existing.code) {
      const codeUpper = dto.code.trim().toUpperCase();
      const duplicate = await this.prisma.department.findUnique({
        where: { code: codeUpper },
      });
      if (duplicate) {
        throw new ConflictException(`Department with code "${codeUpper}" already exists`);
      }
      updateData.code = codeUpper;
    }

    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    return this.prisma.department.update({
      where: { id },
      data: updateData,
    });
  }
}
