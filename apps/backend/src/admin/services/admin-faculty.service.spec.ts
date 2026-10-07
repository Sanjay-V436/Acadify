import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminFacultyService } from './admin-faculty.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ProfilesService } from '../../profiles/profiles.service';

describe('AdminFacultyService - RBAC & Ownership Enforcement', () => {
  let service: AdminFacultyService;
  let prisma: any;
  let profilesService: any;

  const mockFacultyUser = {
    id: 'user-uuid-1',
    name: 'Dr. Alan Turing',
    email: 'alan@amrita.edu',
    passwordHash: 'hashed_password_123',
    role: Role.FACULTY,
    departmentId: 'dept-ece',
    createdAt: new Date(),
    department: { id: 'dept-ece', name: 'Electronics and Communication Engineering', code: 'ECE' },
    facultyProfile: {
      id: 'profile-uuid-1',
      userId: 'user-uuid-1',
      designation: 'Associate Professor',
      qualification: 'PhD',
      experienceYears: 10,
      researchInterests: ['Cryptography', 'Turing Machines'],
      publications: ['On Computable Numbers (1936)'],
      specialization: 'Theoretical Computer Science',
      currentResearch: 'Decidability',
      skills: ['Mathematics', 'Logic'],
      preferredDomains: ['AI'],
      preferredTechnologies: ['Python'],
      facultyWebpageUrl: 'https://amrita.edu/alan',
      googleScholarUrl: null,
      orcidUrl: null,
      linkedinUrl: null,
      availableForProjects: true,
      maxStudents: 5,
      currentStudents: 2,
      teachingAssignments: [],
    },
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findFirst: jest.fn().mockResolvedValue(mockFacultyUser),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.email === 'taken@amrita.edu') {
            return Promise.resolve({ id: 'other-user-uuid', email: 'taken@amrita.edu' });
          }
          if (where.email === 'alan@amrita.edu') {
            return Promise.resolve({ id: 'user-uuid-1', email: 'alan@amrita.edu' });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockImplementation(({ data }) => {
          return Promise.resolve({ ...mockFacultyUser, ...data });
        }),
      },
      department: {
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 'dept-cse') {
            return Promise.resolve({ id: 'dept-cse', name: 'Computer Science Engineering', code: 'CSE' });
          }
          return Promise.resolve(null);
        }),
      },
      facultyProfile: {
        update: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    profilesService = {
      reembedFacultyProfile: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminFacultyService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProfilesService, useValue: profilesService },
      ],
    }).compile();

    service = module.get<AdminFacultyService>(AdminFacultyService);
  });

  describe('Test 1 — Admin Email Update', () => {
    it('should successfully update User.email when valid and unique', async () => {
      const result = await service.update('user-uuid-1', {
        email: 'alan.turing@amrita.edu',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { email: 'alan.turing@amrita.edu' },
      });
      // FacultyProfile must NOT be updated
      expect(prisma.facultyProfile.update).not.toHaveBeenCalled();
      // ChromaDB re-embedding must NOT be triggered
      expect(profilesService.reembedFacultyProfile).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should reject email update if already taken by another user', async () => {
      await expect(
        service.update('user-uuid-1', { email: 'taken@amrita.edu' }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should reject email update if format is invalid', async () => {
      await expect(
        service.update('user-uuid-1', { email: 'invalid-email-address' }),
      ).rejects.toThrow(BadRequestException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Test 2 — Admin Department Update', () => {
    it('should successfully update User.departmentId when department exists', async () => {
      await service.update('user-uuid-1', {
        departmentId: 'dept-cse',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: { departmentId: 'dept-cse' },
      });
      // Faculty profile must remain unchanged
      expect(prisma.facultyProfile.update).not.toHaveBeenCalled();
      expect(profilesService.reembedFacultyProfile).not.toHaveBeenCalled();
    });

    it('should reject department update if department does not exist', async () => {
      await expect(
        service.update('user-uuid-1', { departmentId: 'non-existent-dept' }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('Test 3 — Admin Attempts to Update Professional Profile Fields', () => {
    it('should IGNORE any professional/research fields sent to admin update', async () => {
      // Malicious or accidental payload attempting to overwrite research data via Admin API
      const maliciousPayload = {
        email: 'alan.turing@amrita.edu',
        departmentId: 'dept-cse',
        designation: 'Hacked Professor',
        researchInterests: ['Hacked Interests'],
        specialization: 'Hacked Spec',
        publications: ['Fake Publication'],
        availableForProjects: false,
        maxStudents: 99,
      } as any;

      await service.update('user-uuid-1', maliciousPayload);

      // ONLY email and departmentId should be passed to user.update
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-uuid-1' },
        data: {
          email: 'alan.turing@amrita.edu',
          departmentId: 'dept-cse',
        },
      });

      // FacultyProfile MUST NEVER be updated
      expect(prisma.facultyProfile.update).not.toHaveBeenCalled();

      // AI re-embedding MUST NOT be triggered
      expect(profilesService.reembedFacultyProfile).not.toHaveBeenCalled();
    });
  });
});
