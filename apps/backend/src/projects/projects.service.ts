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
  createdAt: true,
  updatedAt: true,
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

  async createForStudent(userId: string, input: CreateProjectInput) {
    const data = this.validateInput(input, false);

    return this.prisma.$transaction(async (transaction) => {
      return transaction.project.create({
        data: {
          ...data,
          status: ProjectStatus.PROPOSED,
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
