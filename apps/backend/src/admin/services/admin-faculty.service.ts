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
  UpdateFacultyDto,
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
          maxStudents: dto.maxStudents !== undefined ? Number(dto.maxStudents) : 4,
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

  async update(id: string, dto: UpdateFacultyDto) {
    const faculty = await this.findOne(id);
    if (!faculty) {
      throw new NotFoundException(`Faculty member with ID or Profile ID "${id}" not found`);
    }
    const userId = faculty.userId;

    const userData: Record<string, unknown> = {};
    const profileData: Record<string, unknown> = {};

    if (dto.name !== undefined) userData.name = dto.name.trim();
    if (dto.departmentId !== undefined) {
      if (dto.departmentId) {
        const dept = await this.prisma.department.findUnique({
          where: { id: dto.departmentId },
        });
        if (!dept) {
          throw new NotFoundException(`Department with ID "${dto.departmentId}" not found`);
        }
      }
      userData.departmentId = dto.departmentId || null;
    }

    if (dto.designation !== undefined) profileData.designation = dto.designation ? dto.designation.trim() : null;
    if (dto.bio !== undefined) profileData.bio = dto.bio ? dto.bio.trim() : null;
    if (dto.qualification !== undefined) profileData.qualification = dto.qualification ? dto.qualification.trim() : null;
    if (dto.experienceYears !== undefined) profileData.experienceYears = Number(dto.experienceYears);
    if (dto.specialization !== undefined) profileData.specialization = dto.specialization ? dto.specialization.trim() : null;
    if (dto.maxStudents !== undefined) profileData.maxStudents = Number(dto.maxStudents);

    await this.prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userData,
        });
      }

      if (Object.keys(profileData).length > 0) {
        await tx.facultyProfile.update({
          where: { userId },
          data: profileData,
        });
      }
    });

    if (Object.keys(profileData).length > 0) {
      try {
        await this.profilesService.reembedFacultyProfile(userId);
      } catch {
        // Non-blocking
      }
    }

    return this.findOne(userId);
  }
}
