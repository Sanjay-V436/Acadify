import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface UpdateProfileInput {
  name?: unknown;
  bio?: unknown;
  programme?: unknown;
  studentId?: unknown;
  academicInterests?: unknown;
  careerInterests?: unknown;
  skills?: unknown;
  githubUrl?: unknown;
  linkedinUrl?: unknown;
  portfolioUrl?: unknown;
  designation?: unknown;
  qualification?: unknown;
  experienceYears?: unknown;
  currentResearch?: unknown;
  researchInterests?: unknown;
  specialization?: unknown;
  preferredDomains?: unknown;
  preferredTechnologies?: unknown;
  facultyWebpageUrl?: unknown;
  googleScholarUrl?: unknown;
  orcidUrl?: unknown;
  availableForProjects?: unknown;
  maxStudents?: unknown;
}

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  bio: true,
  programme: true,
  studentId: true,
  currentSemester: true,
  academicInterests: true,
  careerInterests: true,
  skills: true,
  githubUrl: true,
  linkedinUrl: true,
  portfolioUrl: true,
  department: { select: { name: true, code: true } },
  projectsAsStudent: {
    select: {
      project: {
        select: {
          id: true,
          title: true,
          description: true,
          domain: true,
          technologies: true,
          githubUrl: true,
          liveDemoUrl: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { project: { updatedAt: 'desc' as const } },
  },
  facultyProfile: {
    select: {
      id: true,
      designation: true,
      bio: true,
      qualification: true,
      experienceYears: true,
      researchInterests: true,
      currentResearch: true,
      skills: true,
      specialization: true,
      preferredDomains: true,
      preferredTechnologies: true,
      availableForProjects: true,
      maxStudents: true,
      currentStudents: true,
      facultyWebpageUrl: true,
      googleScholarUrl: true,
      orcidUrl: true,
      linkedinUrl: true,
    },
  },
} as const;

@Injectable()
export class ProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMine(userId: string, role: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelect,
    });

    if (!user) throw new NotFoundException('Profile not found');
    if (role === 'FACULTY' && !user.facultyProfile) {
      throw new NotFoundException('Faculty profile not found');
    }

    return {
      ...user,
      projects: user.projectsAsStudent.map((item) => item.project),
      projectsAsStudent: undefined,
    };
  }

  async updateMine(userId: string, role: string, input: UpdateProfileInput) {
    const userData: Record<string, unknown> = {};
    const facultyData: Record<string, unknown> = {};

    this.setText(userData, input.name, 'name');
    this.setText(userData, input.bio, 'bio');
    this.setText(userData, input.programme, 'programme');
    this.setText(userData, input.studentId, 'studentId');
    this.setList(userData, input.academicInterests, 'academicInterests');
    this.setList(userData, input.careerInterests, 'careerInterests');
    this.setText(userData, input.githubUrl, 'githubUrl', true);
    this.setText(userData, input.linkedinUrl, 'linkedinUrl', true);
    this.setText(userData, input.portfolioUrl, 'portfolioUrl', true);

    if (role === 'STUDENT') {
      this.setList(userData, input.skills, 'skills');
    }

    if (role === 'FACULTY') {
      this.setText(facultyData, input.designation, 'designation');
      this.setText(facultyData, input.bio, 'bio');
      this.setText(facultyData, input.qualification, 'qualification');
      this.setText(facultyData, input.currentResearch, 'currentResearch');
      this.setText(facultyData, input.specialization, 'specialization');
      this.setList(facultyData, input.researchInterests, 'researchInterests');
      this.setList(facultyData, input.skills, 'skills');
      this.setList(facultyData, input.preferredDomains, 'preferredDomains');
      this.setList(
        facultyData,
        input.preferredTechnologies,
        'preferredTechnologies',
      );
      this.setText(
        facultyData,
        input.facultyWebpageUrl,
        'facultyWebpageUrl',
        true,
      );
      this.setText(
        facultyData,
        input.googleScholarUrl,
        'googleScholarUrl',
        true,
      );
      this.setText(facultyData, input.orcidUrl, 'orcidUrl', true);
      this.setText(facultyData, input.linkedinUrl, 'linkedinUrl', true);

      if (input.experienceYears !== undefined) {
        facultyData.experienceYears = this.integer(
          input.experienceYears,
          'experienceYears',
        );
      }
      if (input.availableForProjects !== undefined) {
        if (typeof input.availableForProjects !== 'boolean')
          throw new BadRequestException('availableForProjects must be boolean');
        facultyData.availableForProjects = input.availableForProjects;
      }
      if (input.maxStudents !== undefined)
        facultyData.maxStudents = this.integer(
          input.maxStudents,
          'maxStudents',
        );
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        if (Object.keys(userData).length) {
          await transaction.user.update({
            where: { id: userId },
            data: userData,
          });
        }
        if (role === 'FACULTY' && Object.keys(facultyData).length) {
          await transaction.facultyProfile.update({
            where: { userId },
            data: facultyData,
          });
        }
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message.includes('User_studentId_key')
      ) {
        throw new ConflictException('That student ID is already in use');
      }
      throw error;
    }

    if (role === 'FACULTY') {
      await this.reembedFacultyProfile(userId);
    }

    return this.getMine(userId, role);
  }

  private setText(
    target: Record<string, unknown>,
    value: unknown,
    field: string,
    url = false,
  ) {
    if (value === undefined) return;
    if (value !== null && typeof value !== 'string')
      throw new BadRequestException(`${field} must be a string`);
    const normalized = typeof value === 'string' ? value.trim() : null;
    if (url && normalized) this.validateUrl(normalized, field);
    target[field] = normalized || null;
  }

  private setList(
    target: Record<string, unknown>,
    value: unknown,
    field: string,
  ) {
    if (value === undefined) return;
    if (!Array.isArray(value))
      throw new BadRequestException(`${field} must be an array of strings`);
    const strings = value.filter(
      (item): item is string => typeof item === 'string',
    );
    if (strings.length !== value.length)
      throw new BadRequestException(`${field} must be an array of strings`);
    target[field] = [
      ...new Set(strings.map((item) => item.trim()).filter(Boolean)),
    ];
  }

  private integer(value: unknown, field: string) {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isInteger(parsed) || parsed < 0)
      throw new BadRequestException(`${field} must be a non-negative integer`);
    return parsed;
  }

  private validateUrl(value: string, field: string) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      throw new BadRequestException(
        `${field} must be a valid HTTP or HTTPS URL`,
      );
    }
  }

  async reembedFacultyProfile(userId: string) {
    const profile = await this.prisma.facultyProfile.findUnique({
      where: { userId },
      select: {
        id: true,
        designation: true,
        researchInterests: true,
        currentResearch: true,
        specialization: true,
        skills: true,
        bio: true,
        qualification: true,
      },
    });

    if (!profile) return;

    const combinedText = [
      profile.designation,
      profile.qualification,
      profile.researchInterests?.join(', '),
      profile.currentResearch,
      profile.specialization,
      profile.skills?.join(', '),
      profile.bio,
    ]
      .filter(Boolean)
      .join('. ');

    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
      await fetch(`${aiServiceUrl}/ai/faculty-profile/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faculty_id: profile.id, text: combinedText }),
      });
    } catch (err) {
      console.error('Failed to re-embed faculty profile:', err);
      // Don't throw — profile save should succeed even if re-embedding fails
    }
  }
}
