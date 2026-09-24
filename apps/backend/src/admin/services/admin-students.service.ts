import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateStudentDto,
  UpdateStudentDto,
  FilterStudentDto,
  BulkImportStudentsDto,
  parsePagination,
  buildPaginatedResponse,
} from '../dto/admin.dto';

const studentSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  bio: true,
  programme: true,
  studentId: true,
  departmentId: true,
  classId: true,
  academicInterests: true,
  careerInterests: true,
  skills: true,
  githubUrl: true,
  linkedinUrl: true,
  portfolioUrl: true,
  createdAt: true,
  department: {
    select: { id: true, name: true, code: true },
  },
  class: {
    include: {
      department: { select: { id: true, name: true, code: true } },
    },
  },
} as const;

@Injectable()
export class AdminStudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateStudentDto) {
    if (!dto.email || !dto.password || !dto.name) {
      throw new BadRequestException('email, password, and name are required');
    }

    if (!dto.studentId || !dto.studentId.trim()) {
      throw new BadRequestException('studentId (student roll number) is required for all STUDENT accounts');
    }

    const emailLower = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });
    if (existing) {
      throw new ConflictException(`An account with email "${emailLower}" already exists`);
    }

    const studentIdClean = dto.studentId.trim();
    const existingStudentId = await this.prisma.user.findFirst({
      where: { studentId: studentIdClean },
    });
    if (existingStudentId) {
      throw new ConflictException(`Student ID "${studentIdClean}" is already assigned to another user`);
    }

    let departmentId: string | null = dto.departmentId || null;
    let classId: string | null = dto.classId || null;

    if (classId) {
      const cls = await this.prisma.class.findUnique({
        where: { id: classId },
      });
      if (!cls) {
        throw new NotFoundException(`Class with ID "${classId}" not found`);
      }
      departmentId = cls.departmentId;
    } else if (departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: departmentId },
      });
      if (!dept) {
        throw new NotFoundException(`Department with ID "${departmentId}" not found`);
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.user.create({
      data: {
        email: emailLower,
        passwordHash,
        name: dto.name.trim(),
        role: Role.STUDENT,
        studentId: studentIdClean,
        programme: dto.programme ? dto.programme.trim() : null,
        departmentId,
        classId,
        academicInterests: [],
        careerInterests: [],
        skills: [],
      },
      select: studentSelect,
    });
  }

  async findAll(query: FilterStudentDto) {
    const { page, limit, skip } = parsePagination(query);

    const where: Record<string, unknown> = {
      role: Role.STUDENT,
    };

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.classId) {
      where.classId = query.classId;
    }

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { studentId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: studentSelect,
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return buildPaginatedResponse(data, total, page, limit);
  }

  async findOne(id: string) {
    const student = await this.prisma.user.findUnique({
      where: { id },
      select: studentSelect,
    });

    if (!student || student.role !== Role.STUDENT) {
      throw new NotFoundException(`Student with ID "${id}" not found`);
    }

    return student;
  }

  async update(id: string, dto: UpdateStudentDto) {
    const existing = await this.findOne(id);

    if (dto.studentId && dto.studentId.trim() !== existing.studentId) {
      const studentIdTrimmed = dto.studentId.trim();
      const duplicate = await this.prisma.user.findFirst({
        where: { studentId: studentIdTrimmed, id: { not: id } },
      });
      if (duplicate) {
        throw new ConflictException(`Student ID "${studentIdTrimmed}" is already assigned to another user`);
      }
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.studentId !== undefined) updateData.studentId = dto.studentId ? dto.studentId.trim() : null;
    if (dto.programme !== undefined) updateData.programme = dto.programme ? dto.programme.trim() : null;
    if (dto.classId !== undefined) {
      if (dto.classId) {
        const cls = await this.prisma.class.findUnique({ where: { id: dto.classId } });
        if (!cls) throw new NotFoundException(`Class with ID "${dto.classId}" not found`);
        updateData.classId = dto.classId;
        updateData.departmentId = cls.departmentId;
      } else {
        updateData.classId = null;
      }
    } else if (dto.departmentId !== undefined) {
      updateData.departmentId = dto.departmentId || null;
    }

    if (dto.password && dto.password.trim()) {
      updateData.passwordHash = await bcrypt.hash(dto.password.trim(), 10);
    }

    return this.prisma.user.update({
      where: { id },
      data: updateData,
      select: studentSelect,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.user.delete({
      where: { id },
    });
    return { success: true };
  }

  async importStudentsBulk(dto: BulkImportStudentsDto) {
    if (!dto || !Array.isArray(dto.students)) {
      throw new BadRequestException('students array is required');
    }

    const errors: { row: number; field: string; message: string }[] = [];
    const processedRows: {
      row: number;
      studentId: string;
      name: string;
      email: string;
      passwordHash: string;
      classId: string;
      departmentId: string;
    }[] = [];

    const emailsInBatch = new Set<string>();
    const studentIdsInBatch = new Set<string>();

    const classes = await this.prisma.class.findMany();
    const classMap = new Map(classes.map((c) => [c.id, c]));

    const existingUsers = await this.prisma.user.findMany({
      select: { email: true, studentId: true },
    });
    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
    const existingStudentIds = new Set(
      existingUsers.filter((u) => u.studentId).map((u) => u.studentId!.toLowerCase()),
    );

    for (let i = 0; i < dto.students.length; i++) {
      const item = dto.students[i];
      const rowNum = i + 1;

      if (!item.studentId || !item.studentId.trim()) {
        errors.push({ row: rowNum, field: 'studentId', message: 'studentId is required' });
      }
      if (!item.name || !item.name.trim()) {
        errors.push({ row: rowNum, field: 'name', message: 'name is required' });
      }
      if (!item.email || !item.email.trim() || !item.email.includes('@')) {
        errors.push({ row: rowNum, field: 'email', message: 'Valid email address is required' });
      }
      if (!item.password || !item.password.trim()) {
        errors.push({ row: rowNum, field: 'password', message: 'password is required' });
      }
      if (!item.classId || !item.classId.trim()) {
        errors.push({ row: rowNum, field: 'classId', message: 'classId is required' });
      }

      if (!item.classId || !classMap.has(item.classId.trim())) {
        errors.push({ row: rowNum, field: 'classId', message: `Class with ID "${item.classId}" does not exist` });
      }

      if (item.email) {
        const emailLower = item.email.trim().toLowerCase();
        if (emailsInBatch.has(emailLower) || existingEmails.has(emailLower)) {
          errors.push({ row: rowNum, field: 'email', message: `Email "${emailLower}" already exists` });
        } else {
          emailsInBatch.add(emailLower);
        }
      }

      if (item.studentId) {
        const studentIdClean = item.studentId.trim();
        const studentIdLower = studentIdClean.toLowerCase();
        if (studentIdsInBatch.has(studentIdLower) || existingStudentIds.has(studentIdLower)) {
          errors.push({ row: rowNum, field: 'studentId', message: `Student ID "${studentIdClean}" already exists` });
        } else {
          studentIdsInBatch.add(studentIdLower);
        }
      }

      if (!errors.some((e) => e.row === rowNum) && item.classId && classMap.has(item.classId.trim())) {
        const cls = classMap.get(item.classId.trim())!;
        const passwordHash = await bcrypt.hash(item.password.trim(), 10);

        processedRows.push({
          row: rowNum,
          studentId: item.studentId.trim(),
          name: item.name.trim(),
          email: item.email.trim().toLowerCase(),
          passwordHash,
          classId: cls.id,
          departmentId: cls.departmentId,
        });
      }
    }

    if (errors.length > 0) {
      return {
        total: dto.students.length,
        imported: 0,
        failed: errors.length,
        errors,
      };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const row of processedRows) {
        await tx.user.create({
          data: {
            email: row.email,
            passwordHash: row.passwordHash,
            name: row.name,
            role: Role.STUDENT,
            studentId: row.studentId,
            classId: row.classId,
            departmentId: row.departmentId,
            academicInterests: [],
            careerInterests: [],
            skills: [],
          },
        });
      }
    });

    return {
      total: dto.students.length,
      imported: processedRows.length,
      failed: 0,
      errors: [],
    };
  }
}
