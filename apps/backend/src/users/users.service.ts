import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async createUser(data: {
    email: string;
    passwordHash: string;
    name: string;
    role: Role;
    academicInterests: string[];
    careerInterests: string[];
    skills: string[];
    departmentId?: string;
    currentSemester?: number;
    bio?: string;
    programme?: string;
    studentId?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    portfolioUrl?: string;
    classId?: string;
  }) {
    return this.prisma.user.create({
      data,
    });
  }
}