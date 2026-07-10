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
    departmentId?: string;
    currentSemester?: number;
  }) {
    return this.prisma.user.create({ data });
  }
}
