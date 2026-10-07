import { Test, TestingModule } from '@nestjs/testing';
import { ProfilesService } from './profiles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProfilesService - Faculty Self-Edit & Re-embedding', () => {
  let service: ProfilesService;
  let prisma: any;

  const mockFacultyUser = {
    id: 'user-faculty-1',
    name: 'Dr. Ada Lovelace',
    email: 'ada@amrita.edu',
    role: 'FACULTY',
    bio: 'Pioneer of computing',
    department: { name: 'Computer Science Engineering', code: 'CSE' },
    projectsAsStudent: [],
    facultyProfile: {
      id: 'profile-faculty-1',
      userId: 'user-faculty-1',
      designation: 'Professor',
      qualification: 'PhD',
      experienceYears: 15,
      researchInterests: ['Algorithms', 'Computational Science'],
      publications: ['Notes on the Analytical Engine'],
      currentResearch: 'Analytical computation',
      skills: ['Mathematics'],
      specialization: 'Computation',
      preferredDomains: ['CS'],
      preferredTechnologies: ['Logic'],
      facultyWebpageUrl: 'https://amrita.edu/ada',
      googleScholarUrl: null,
      orcidUrl: null,
      linkedinUrl: null,
      availableForProjects: true,
      maxStudents: 5,
      currentStudents: 1,
    },
  };

  beforeEach(async () => {
    // Mock global fetch for AI service calls
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'ok' }),
    });

    prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(mockFacultyUser),
        update: jest.fn().mockResolvedValue(mockFacultyUser),
      },
      facultyProfile: {
        findUnique: jest.fn().mockResolvedValue({
          ...mockFacultyUser.facultyProfile,
          user: { name: mockFacultyUser.name, email: mockFacultyUser.email },
        }),
        update: jest.fn().mockResolvedValue(mockFacultyUser.facultyProfile),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ProfilesService>(ProfilesService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Test 4 — Faculty Profile Self-Update & Re-embedding', () => {
    it('should update professional profile fields and trigger re-embedding with full metadata', async () => {
      const updatePayload = {
        researchInterests: ['Algorithms', 'Computational Science', 'Generative AI'],
        specialization: 'Quantum & Classical Algorithms',
        publications: ['Notes on the Analytical Engine', 'Modern Extensions (2026)'],
      };

      await service.updateMine('user-faculty-1', 'FACULTY', updatePayload);

      // Verify facultyProfile.update was called with updated research fields
      expect(prisma.facultyProfile.update).toHaveBeenCalledWith({
        where: { userId: 'user-faculty-1' },
        data: expect.objectContaining({
          researchInterests: ['Algorithms', 'Computational Science', 'Generative AI'],
          specialization: 'Quantum & Classical Algorithms',
          publications: ['Notes on the Analytical Engine', 'Modern Extensions (2026)'],
        }),
      });

      // Verify AI re-embedding was triggered
      expect((global as any).fetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/faculty-profile/embed'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"faculty_id":"profile-faculty-1"'),
        }),
      );

      // Verify metadata payload is NOT empty strings
      const fetchCallBody = JSON.parse(((global as any).fetch as jest.Mock).mock.calls[0][1].body);
      expect(fetchCallBody.metadata).toEqual(
        expect.objectContaining({
          name: 'Dr. Ada Lovelace',
          email: 'ada@amrita.edu',
          designation: 'Professor',
          qualification: 'PhD',
          research_interests: expect.stringContaining('Algorithms'),
          publications: 'Notes on the Analytical Engine',
          profile_url: 'https://amrita.edu/ada',
          available_for_projects: true,
          max_students: 5,
          current_students: 1,
        }),
      );
    });

    it('should NOT allow Faculty to modify email or departmentId via profile edit', async () => {
      const unauthorizedPayload = {
        email: 'hacked@amrita.edu',
        departmentId: 'dept-other',
        specialization: 'Updated Specialization',
      } as any;

      await service.updateMine('user-faculty-1', 'FACULTY', unauthorizedPayload);

      // Verify user.update is NOT called with email or departmentId
      if (prisma.user.update.mock.calls.length > 0) {
        const updateData = prisma.user.update.mock.calls[0][0].data;
        expect(updateData.email).toBeUndefined();
        expect(updateData.departmentId).toBeUndefined();
      }
    });
  });

  describe('Dynamic Faculty Mentor Availability', () => {
    it('TEST 1 & TEST 8: should update availability only without triggering Chroma re-embedding', async () => {
      // Setup mock return for getMine after update
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockFacultyUser,
        facultyProfile: {
          ...mockFacultyUser.facultyProfile,
          availableForProjects: true,
          maxStudents: 5,
          currentStudents: 0,
        },
      });

      const res = await service.updateMine('user-faculty-1', 'FACULTY', {
        availableForProjects: true,
        maxStudents: 5,
        currentStudents: 0,
      });

      // Verify PostgreSQL update
      expect(prisma.facultyProfile.update).toHaveBeenCalledWith({
        where: { userId: 'user-faculty-1' },
        data: {
          availableForProjects: true,
          maxStudents: 5,
          currentStudents: 0,
        },
      });

      // Verify NO Chroma re-embedding was triggered
      expect((global as any).fetch).not.toHaveBeenCalled();

      // Verify availableSlots = 5 - 0 = 5
      expect(res.facultyProfile?.availableSlots).toBe(5);
      expect(res.availableSlots).toBe(5);
    });

    it('TEST 2: should correctly calculate availableSlots when maxStudents=5, currentStudents=2', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockFacultyUser,
        facultyProfile: {
          ...mockFacultyUser.facultyProfile,
          maxStudents: 5,
          currentStudents: 2,
        },
      });

      const res = await service.updateMine('user-faculty-1', 'FACULTY', {
        maxStudents: 5,
        currentStudents: 2,
      });

      expect(res.facultyProfile?.availableSlots).toBe(3);
      expect((global as any).fetch).not.toHaveBeenCalled();
    });

    it('TEST 3: should correctly calculate availableSlots when maxStudents=10, currentStudents=4', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockFacultyUser,
        facultyProfile: {
          ...mockFacultyUser.facultyProfile,
          maxStudents: 10,
          currentStudents: 4,
        },
      });

      const res = await service.updateMine('user-faculty-1', 'FACULTY', {
        maxStudents: 10,
        currentStudents: 4,
      });

      expect(res.facultyProfile?.availableSlots).toBe(6);
    });

    it('TEST 4: should reject when currentStudents > maxStudents', async () => {
      await expect(
        service.updateMine('user-faculty-1', 'FACULTY', {
          maxStudents: 5,
          currentStudents: 6,
        }),
      ).rejects.toThrow('Currently mentoring students cannot exceed maximum students');
    });

    it('TEST 5: should reject when maxStudents < 0', async () => {
      await expect(
        service.updateMine('user-faculty-1', 'FACULTY', {
          maxStudents: -1,
        }),
      ).rejects.toThrow('maxStudents must be a non-negative integer');
    });

    it('TEST 6: should reject when currentStudents < 0', async () => {
      await expect(
        service.updateMine('user-faculty-1', 'FACULTY', {
          currentStudents: -1,
        }),
      ).rejects.toThrow('currentStudents must be a non-negative integer');
    });

    it('TEST 7: should persist availableForProjects = false', async () => {
      prisma.user.findUnique.mockResolvedValueOnce({
        ...mockFacultyUser,
        facultyProfile: {
          ...mockFacultyUser.facultyProfile,
          availableForProjects: false,
        },
      });

      const res = await service.updateMine('user-faculty-1', 'FACULTY', {
        availableForProjects: false,
      });

      expect(prisma.facultyProfile.update).toHaveBeenCalledWith({
        where: { userId: 'user-faculty-1' },
        data: {
          availableForProjects: false,
        },
      });
      expect(res.facultyProfile?.availableForProjects).toBe(false);
    });

    it('TEST 9: should trigger Chroma re-embedding when researchInterests changes', async () => {
      await service.updateMine('user-faculty-1', 'FACULTY', {
        researchInterests: ['Quantum Machine Learning'],
      });

      expect((global as any).fetch).toHaveBeenCalledWith(
        expect.stringContaining('/ai/faculty-profile/embed'),
        expect.anything(),
      );
    });
  });
});

