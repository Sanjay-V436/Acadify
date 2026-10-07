import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfilesService } from '../../profiles/profiles.service';
import {
  CreateFacultyDto,
  AdminUpdateFacultyAccountDto,
  FilterFacultyDto,
  parsePagination,
  buildPaginatedResponse,
} from '../dto/admin.dto';

const formatFacultyResponse = (user: any) => {
  if (!user) return null;
  const profile = user.facultyProfile || {};
  return {
    userId: user.id,
    facultyProfileId: profile.id || null,
    name: user.name,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId,
    department: user.department,
    createdAt: user.createdAt,
    profile: {
      id: profile.id,
      userId: user.id,
      designation: profile.designation,
      bio: profile.bio,
      qualification: profile.qualification,
      experienceYears: profile.experienceYears,
      researchInterests: profile.researchInterests || [],
      publications: profile.publications || [],
      currentResearch: profile.currentResearch,
      skills: profile.skills || [],
      specialization: profile.specialization,
      preferredDomains: profile.preferredDomains || [],
      preferredTechnologies: profile.preferredTechnologies || [],
      facultyWebpageUrl: profile.facultyWebpageUrl,
      googleScholarUrl: profile.googleScholarUrl,
      orcidUrl: profile.orcidUrl,
      linkedinUrl: profile.linkedinUrl,
      availableForProjects: profile.availableForProjects,
      maxStudents: profile.maxStudents,
      currentStudents: profile.currentStudents,
      teachingAssignments: (profile.teachingAssignments || []).map((ta: any) => ({
        id: ta.id,
        classId: ta.classId,
        subjectId: ta.subjectId,
        class: ta.class,
        subject: ta.subject,
      })),
    },
  };
};

@Injectable()
export class AdminFacultyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profilesService: ProfilesService,
  ) {}

  async create(dto: CreateFacultyDto) {
    if (!dto.email || !dto.password || !dto.name) {
      throw new BadRequestException('email, password, and name are required');
    }

    const emailLower = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });
    if (existing) {
      throw new ConflictException(`An account with email "${emailLower}" already exists`);
    }

    if (dto.departmentId) {
      const dept = await this.prisma.department.findUnique({
        where: { id: dto.departmentId },
      });
      if (!dept) {
        throw new NotFoundException(`Department with ID "${dto.departmentId}" not found`);
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: emailLower,
          passwordHash,
          name: dto.name.trim(),
          role: Role.FACULTY,
          departmentId: dto.departmentId || null,
          academicInterests: [],
          careerInterests: [],
          skills: [],
        },
      });

      const facultyProfile = await tx.facultyProfile.create({
        data: {
          userId: newUser.id,
          designation: dto.designation ? dto.designation.trim() : null,
          bio: dto.bio ? dto.bio.trim() : null,
          qualification: dto.qualification ? dto.qualification.trim() : null,
          experienceYears: dto.experienceYears !== undefined ? Number(dto.experienceYears) : null,
          specialization: dto.specialization ? dto.specialization.trim() : null,
          publications: dto.publications || [],
          researchInterests: [],
          skills: [],
          preferredDomains: [],
          preferredTechnologies: [],
          availableForProjects: true,
          maxStudents: dto.maxStudents !== undefined ? Number(dto.maxStudents) : 5,
          currentStudents: 0,
        },
      });

      return {
        ...newUser,
        facultyProfile,
      };
    });

    // Re-embed profile for AI mentor recommendations
    try {
      await this.profilesService.reembedFacultyProfile(user.id);
    } catch {
      // Non-blocking if AI service unreachable
    }

    return formatFacultyResponse(user);
  }

  async findAll(query: FilterFacultyDto) {
    const { page, limit, skip } = parsePagination(query);

    const where: Record<string, unknown> = {
      role: Role.FACULTY,
    };

    if (query.departmentId) {
      where.departmentId = query.departmentId;
    }

    if (query.search && query.search.trim()) {
      const search = query.search.trim();
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        {
          facultyProfile: {
            specialization: { contains: search, mode: 'insensitive' },
          },
        },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        include: {
          department: { select: { id: true, name: true, code: true } },
          facultyProfile: {
            include: {
              teachingAssignments: {
                include: {
                  class: { include: { department: true } },
                  subject: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const formattedData = users.map(formatFacultyResponse);
    return buildPaginatedResponse(formattedData, total, page, limit);
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id },
          { facultyProfile: { id } },
        ],
        role: Role.FACULTY,
      },
      include: {
        department: { select: { id: true, name: true, code: true } },
        facultyProfile: {
          include: {
            teachingAssignments: {
              include: {
                class: { include: { department: true } },
                subject: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`Faculty member with ID or Profile ID "${id}" not found`);
    }

    return formatFacultyResponse(user);
  }

  async update(id: string, dto: AdminUpdateFacultyAccountDto) {
    const faculty = await this.findOne(id);
    if (!faculty) {
      throw new NotFoundException(`Faculty member with ID or Profile ID "${id}" not found`);
    }
    const userId = faculty.userId;

    const userData: { email?: string; departmentId?: string | null } = {};

    // 1. Email update & validation
    if (dto.email !== undefined) {
      if (!dto.email || typeof dto.email !== 'string') {
        throw new BadRequestException('Email must be a non-empty string');
      }
      const emailLower = dto.email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailLower)) {
        throw new BadRequestException(`"${dto.email}" is not a valid email address`);
      }

      const existing = await this.prisma.user.findUnique({
        where: { email: emailLower },
      });
      if (existing && existing.id !== userId) {
        throw new ConflictException(`An account with email "${emailLower}" already exists`);
      }
      userData.email = emailLower;
    }

    // 2. Department update & validation
    if (dto.departmentId !== undefined) {
      if (dto.departmentId) {
        const deptId = String(dto.departmentId).trim();
        const dept = await this.prisma.department.findUnique({
          where: { id: deptId },
        });
        if (!dept) {
          throw new NotFoundException(`Department with ID "${dto.departmentId}" not found`);
        }
        userData.departmentId = deptId;
      } else {
        userData.departmentId = null;
      }
    }

    // 3. Apply updates to User only (never touch FacultyProfile or re-embed AI)
    if (Object.keys(userData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: userData,
      });
    }

    return this.findOne(userId);
  }
}
