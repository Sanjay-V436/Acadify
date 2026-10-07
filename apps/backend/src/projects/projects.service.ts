import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProjectStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateProjectInput {
  title?: unknown;
  description?: unknown;
  domain?: unknown;
  techStack?: unknown;
  technologies?: unknown;
  githubUrl?: unknown;
  liveDemoUrl?: unknown;
  imageUrl?: unknown;
  status?: unknown;
  isPublished?: unknown;
}

export type UpdateProjectInput = Partial<CreateProjectInput>;

const projectSelect = {
  id: true,
  title: true,
  description: true,
  domain: true,
  technologies: true,
  githubUrl: true,
  liveDemoUrl: true,
  imageUrl: true,
  status: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
  mentor: {
    select: {
      id: true,
      designation: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  students: {
    select: {
      user: {
        select: {
          id: true,
          name: true,
          studentId: true,
          email: true,
          currentSemester: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          class: {
            select: {
              batchYear: true,
              section: true,
              currentSemester: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProjectSelect;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllForStudent(userId: string) {
    return this.prisma.project.findMany({
      where: { students: { some: { userId } } },
      select: projectSelect,
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOneForStudent(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, students: { some: { userId } } },
      select: projectSelect,
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async findCommunity(query: {
    search?: string;
    domain?: string;
    tech?: string;
    status?: string;
    departmentId?: string;
    sort?: string;
  }) {
    const where: Prisma.ProjectWhereInput = {
      isPublished: true,
    };

    if (query.domain && query.domain !== 'ALL') {
      where.domain = { equals: query.domain, mode: 'insensitive' };
    }

    if (query.status && query.status !== 'ALL') {
      const s = query.status.toUpperCase();
      if (Object.values(ProjectStatus).includes(s as ProjectStatus)) {
        where.status = s as ProjectStatus;
      }
    }

    if (query.departmentId && query.departmentId !== 'ALL') {
      where.students = {
        some: {
          user: {
            departmentId: query.departmentId,
          },
        },
      };
    }

    if (query.tech && query.tech.trim()) {
      where.technologies = {
        has: query.tech.trim(),
      };
    }

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        { domain: { contains: s, mode: 'insensitive' } },
        { technologies: { hasSome: [s] } },
        {
          students: {
            some: {
              user: {
                OR: [
                  { name: { contains: s, mode: 'insensitive' } },
                  { studentId: { contains: s, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ];
    }

    let orderBy: Prisma.ProjectOrderByWithRelationInput = { updatedAt: 'desc' };
    if (query.sort === 'oldest') {
      orderBy = { createdAt: 'asc' };
    } else if (query.sort === 'alphabetical') {
      orderBy = { title: 'asc' };
    } else if (query.sort === 'newest') {
      orderBy = { createdAt: 'desc' };
    }

    return this.prisma.project.findMany({
      where,
      select: projectSelect,
      orderBy,
    });
  }

  async getCommunityMetadata() {
    const published = await this.prisma.project.findMany({
      where: { isPublished: true },
      select: {
        domain: true,
        technologies: true,
      },
    });

    const domains = Array.from(new Set(published.map((p) => p.domain).filter(Boolean))).sort();
    const techSet = new Set<string>();
    published.forEach((p) => p.technologies?.forEach((t) => techSet.add(t)));
    const technologies = Array.from(techSet).sort();

    const departments = await this.prisma.department.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { code: 'asc' },
    });

    return {
      domains,
      technologies,
      departments,
    };
  }

  async togglePublish(projectId: string, userId: string) {
    const project = await this.findOneForStudent(projectId, userId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { isPublished: !project.isPublished },
      select: projectSelect,
    });
  }

  async createForStudent(userId: string, input: CreateProjectInput) {
    const data = this.validateInput(input, false);

    return this.prisma.$transaction(async (transaction) => {
      return transaction.project.create({
        data: {
          ...data,
          status: data.status || ProjectStatus.PROPOSED,
          isPublished: data.isPublished !== undefined ? data.isPublished : false,
          students: { create: { userId } },
        },
        select: projectSelect,
      });
    });
  }

  async updateForStudent(
    projectId: string,
    userId: string,
    input: UpdateProjectInput,
  ) {
    await this.findOneForStudent(projectId, userId);
    const data = this.validateInput(input, true);

    return this.prisma.project.update({
      where: { id: projectId },
      data,
      select: projectSelect,
    });
  }

  async removeForStudent(projectId: string, userId: string) {
    await this.findOneForStudent(projectId, userId);

    await this.prisma.$transaction([
      this.prisma.projectStudent.deleteMany({ where: { projectId } }),
      this.prisma.project.delete({ where: { id: projectId } }),
    ]);

    return { deleted: true, id: projectId };
  }

  private validateInput(input: CreateProjectInput, partial: boolean) {
    const title = this.optionalString(input.title, 'title');
    const description = this.optionalString(input.description, 'description');
    const domain = this.optionalString(input.domain, 'domain');
    const technologyInput = input.techStack ?? input.technologies;

    if (!partial && (!title || !description || !domain)) {
      throw new BadRequestException(
        'Title, description, and domain are required',
      );
    }

    if (technologyInput !== undefined && !Array.isArray(technologyInput)) {
      throw new BadRequestException('techStack must be an array of strings');
    }

    const technologies = technologyInput?.map((value) => {
      if (typeof value !== 'string' || !value.trim()) {
        throw new BadRequestException(
          'techStack must contain non-empty strings',
        );
      }
      return value.trim();
    });

    if (!partial && (!technologies || technologies.length === 0)) {
      throw new BadRequestException('At least one technology is required');
    }

    const data = {} as Prisma.ProjectUncheckedCreateInput;
    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (domain !== undefined) data.domain = domain;
    if (technologies !== undefined) data.technologies = technologies;

    if (input.isPublished !== undefined) {
      data.isPublished = Boolean(input.isPublished);
    }

    if (input.status !== undefined) {
      const statusStr = String(input.status).toUpperCase();
      if (Object.values(ProjectStatus).includes(statusStr as ProjectStatus)) {
        data.status = statusStr as ProjectStatus;
      }
    }

    for (const field of ['githubUrl', 'liveDemoUrl', 'imageUrl'] as const) {
      const value = input[field];
      if (value === undefined) continue;
      if (value !== null && typeof value !== 'string') {
        throw new BadRequestException(`${field} must be a URL string`);
      }
      if (value) this.validateUrl(value, field);
      data[field] = value || null;
    }

    return data;
  }

  private optionalString(value: unknown, field: string) {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !value.trim()) {
      throw new BadRequestException(`${field} must be a non-empty string`);
    }
    return value.trim();
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
}
