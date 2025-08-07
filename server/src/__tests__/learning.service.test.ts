import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient, SpecificationPhase, DifficultyLevel, ProgressStatus } from '@prisma/client';
import { LearningService } from '../services/learning.service';

// Mock Prisma Client
const mockPrisma = {
  learningModule: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  userProgress: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaClient;

describe('LearningService', () => {
  let learningService: LearningService;
  let result: any;

  beforeEach(() => {
    learningService = new LearningService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('createModule', () => {
    const validModuleData = {
      title: 'Requirements Engineering Basics',
      description: 'Learn the fundamentals of writing clear requirements',
      phase: SpecificationPhase.REQUIREMENTS,
      difficulty: DifficultyLevel.BEGINNER,
      prerequisites: [],
      content: [],
      exercises: [],
      estimatedDuration: 45,
      isPublished: false,
    };

    it('should create a learning module successfully', async () => {
      const mockModule = { id: 'module-1', ...validModuleData };
      mockPrisma.learningModule.create = vi.fn().mockResolvedValue(mockModule);

       result = await learningService.createModule(validModuleData);

      expect(mockPrisma.learningModule.create).toHaveBeenCalledWith({
        data: validModuleData,
      });
      expect(result).toEqual(mockModule);
    });

    it('should validate prerequisites exist before creating module', async () => {
      const moduleWithPrereqs = {
        ...validModuleData,
        prerequisites: ['prereq-1', 'prereq-2'],
      };

      mockPrisma.learningModule.findMany = vi.fn().mockResolvedValue([
        { id: 'prereq-1' },
        { id: 'prereq-2' },
      ]);
      mockPrisma.learningModule.create = vi.fn().mockResolvedValue({
        id: 'module-1',
        ...moduleWithPrereqs,
      });

      await learningService.createModule(moduleWithPrereqs);

      expect(mockPrisma.learningModule.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['prereq-1', 'prereq-2'] } },
        select: { id: true },
      });
    });

    it('should throw error if prerequisites do not exist', async () => {
      const moduleWithPrereqs = {
        ...validModuleData,
        prerequisites: ['prereq-1', 'prereq-2'],
      };

      mockPrisma.learningModule.findMany = vi.fn().mockResolvedValue([
        { id: 'prereq-1' }, // Only one prerequisite exists
      ]);

      await expect(learningService.createModule(moduleWithPrereqs)).rejects.toThrow(
        'Some prerequisite modules do not exist'
      );
    });

    it('should validate input data', async () => {
      const invalidData = {
        title: '', // Invalid: empty title
        description: 'Valid description',
        difficulty: DifficultyLevel.BEGINNER,
        estimatedDuration: 45,
      };

      await expect(learningService.createModule(invalidData as any)).rejects.toThrow();
    });
  });

  describe('getModules', () => {
    it('should return all published modules by default', async () => {
      const mockModules = [
        {
          id: 'module-1',
          title: 'Module 1',
          difficulty: DifficultyLevel.BEGINNER,
          isPublished: true,
        },
        {
          id: 'module-2',
          title: 'Module 2',
          difficulty: DifficultyLevel.INTERMEDIATE,
          isPublished: true,
        },
      ];

      mockPrisma.learningModule.findMany = vi.fn().mockResolvedValue(mockModules);

       result = await learningService.getModules();

      expect(mockPrisma.learningModule.findMany).toHaveBeenCalledWith({
        where: { isPublished: true },
        orderBy: [{ difficulty: 'asc' }, { createdAt: 'asc' }],
      });
      expect(result).toEqual(mockModules);
    });

    it('should filter modules by phase and difficulty', async () => {
      const filters = {
        phase: SpecificationPhase.REQUIREMENTS,
        difficulty: DifficultyLevel.BEGINNER,
      };

      mockPrisma.learningModule.findMany = vi.fn().mockResolvedValue([]);

      await learningService.getModules(filters);

      expect(mockPrisma.learningModule.findMany).toHaveBeenCalledWith({
        where: {
          phase: SpecificationPhase.REQUIREMENTS,
          difficulty: DifficultyLevel.BEGINNER,
          isPublished: true,
        },
        orderBy: [{ difficulty: 'asc' }, { createdAt: 'asc' }],
      });
    });
  });

  describe('getUserProgress', () => {
    it('should return user progress for all modules', async () => {
      const userId = 'user-1';
      const mockProgress = [
        {
          id: 'progress-1',
          userId,
          moduleId: 'module-1',
          status: ProgressStatus.IN_PROGRESS,
          module: { id: 'module-1', title: 'Module 1' },
        },
      ];

      mockPrisma.userProgress.findMany = vi.fn().mockResolvedValue(mockProgress);

       result = await learningService.getUserProgress(userId);

      expect(mockPrisma.userProgress.findMany).toHaveBeenCalledWith({
        where: { userId },
        include: {
          module: {
            select: {
              id: true,
              title: true,
              difficulty: true,
              estimatedDuration: true,
              phase: true,
            },
          },
        },
        orderBy: { lastAccessed: 'desc' },
      });
      expect(result).toEqual(mockProgress);
    });
  });

  describe('updateUserProgress', () => {
    const userId = 'user-1';
    const moduleId = 'module-1';
    const mockModule = { id: moduleId, title: 'Test Module' };

    beforeEach(() => {
      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(mockModule);
    });

    it('should create new progress record if none exists', async () => {
      const progressData = {
        moduleId,
        status: ProgressStatus.IN_PROGRESS,
        completedLessons: ['lesson-1'],
      };

      mockPrisma.userProgress.findUnique = vi.fn().mockResolvedValue(null);
      mockPrisma.userProgress.create = vi.fn().mockResolvedValue({
        id: 'progress-1',
        userId,
        ...progressData,
      });

       result = await learningService.updateUserProgress(userId, progressData);

      expect(mockPrisma.userProgress.create).toHaveBeenCalledWith({
        data: {
          userId,
          moduleId,
          status: ProgressStatus.IN_PROGRESS,
          lastAccessed: expect.any(Date),
          completedLessons: ['lesson-1'],
        },
      });
    });

    it('should throw error if module does not exist', async () => {
      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        learningService.updateUserProgress(userId, { moduleId })
      ).rejects.toThrow('Learning module not found');
    });
  });

  describe('validatePrerequisites', () => {
    const userId = 'user-1';
    const moduleId = 'module-1';

    it('should return canAccess true if no prerequisites', async () => {
      const mockModule = { id: moduleId, prerequisites: [] };
      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(mockModule);

       result = await learningService.validatePrerequisites(userId, moduleId);

      expect(result).toEqual({
        canAccess: true,
        missingPrerequisites: [],
        completedPrerequisites: [],
      });
    });

    it('should return canAccess true if all prerequisites completed', async () => {
      const mockModule = { id: moduleId, prerequisites: ['prereq-1', 'prereq-2'] };
      const mockProgress = [
        { moduleId: 'prereq-1' },
        { moduleId: 'prereq-2' },
      ];

      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(mockModule);
      mockPrisma.userProgress.findMany = vi.fn().mockResolvedValue(mockProgress);

       result = await learningService.validatePrerequisites(userId, moduleId);

      expect(result).toEqual({
        canAccess: true,
        missingPrerequisites: [],
        completedPrerequisites: ['prereq-1', 'prereq-2'],
      });
    });

    it('should return canAccess false if prerequisites missing', async () => {
      const mockModule = { id: moduleId, prerequisites: ['prereq-1', 'prereq-2'] };
      const mockProgress = [{ moduleId: 'prereq-1' }]; // Only one completed

      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(mockModule);
      mockPrisma.userProgress.findMany = vi.fn().mockResolvedValue(mockProgress);

       result = await learningService.validatePrerequisites(userId, moduleId);

      expect(result).toEqual({
        canAccess: false,
        missingPrerequisites: ['prereq-2'],
        completedPrerequisites: ['prereq-1'],
      });
    });
  });

  describe('assessSkill', () => {
    const userId = 'user-1';
    const moduleId = 'module-1';
    const skillId = 'requirements-analysis';

    it('should assess skill and return assessment result', async () => {
      const mockModule = {
        id: moduleId,
        difficulty: DifficultyLevel.BEGINNER,
        phase: SpecificationPhase.REQUIREMENTS,
      };
      const responses = { clarity: 3, testability: 4, completeness: 2 };
      const existingProgress = { id: 'progress-1', skillAssessments: [] };

      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(mockModule);
      mockPrisma.userProgress.findUnique = vi.fn().mockResolvedValue(existingProgress);
      mockPrisma.userProgress.update = vi.fn().mockResolvedValue({});

       result = await learningService.assessSkill(userId, moduleId, skillId, responses);

      expect(result).toMatchObject({
        skillId,
        skillName: 'Requirements Analysis',
        level: DifficultyLevel.BEGINNER,
        score: expect.any(Number),
        maxScore: expect.any(Number),
        assessedAt: expect.any(Date),
        competencies: expect.any(Array),
      });

      expect(result.competencies).toHaveLength(3);
      expect(result.competencies[0]).toMatchObject({
        competencyId: 'clarity',
        name: 'Clarity and Precision',
        score: expect.any(Number),
        maxScore: expect.any(Number),
        feedback: expect.any(String),
      });
    });

    it('should throw error if module not found', async () => {
      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        learningService.assessSkill(userId, moduleId, skillId, {})
      ).rejects.toThrow('Learning module not found');
    });
  });

  describe('getLessonContent', () => {
    it('should return lesson content if found', async () => {
      const moduleId = 'module-1';
      const lessonId = 'lesson-1';
      const lessonContent = {
        id: lessonId,
        type: 'text',
        title: 'Introduction to Requirements',
        content: 'Lesson content here',
        duration: 15,
        order: 1,
      };

      const mockModule = {
        id: moduleId,
        content: [lessonContent],
      };

      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(mockModule);

       result = await learningService.getLessonContent(moduleId, lessonId);

      expect(result).toEqual(lessonContent);
    });

    it('should return null if lesson not found', async () => {
      const mockModule = { id: 'module-1', content: [] };
      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(mockModule);

       result = await learningService.getLessonContent('module-1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should return null if module not found', async () => {
      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(null);

       result = await learningService.getLessonContent('nonexistent', 'lesson-1');

      expect(result).toBeNull();
    });
  });

  describe('getExercise', () => {
    it('should return exercise if found', async () => {
      const moduleId = 'module-1';
      const exerciseId = 'exercise-1';
      const exercise = {
        id: exerciseId,
        type: 'multiple_choice',
        title: 'Requirements Quiz',
        description: 'Test your knowledge',
        instructions: 'Choose the best answer',
        hints: ['Think about clarity'],
        difficulty: DifficultyLevel.BEGINNER,
        points: 10,
      };

      const mockModule = {
        id: moduleId,
        exercises: [exercise],
      };

      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(mockModule);

       result = await learningService.getExercise(moduleId, exerciseId);

      expect(result).toEqual(exercise);
    });

    it('should return null if exercise not found', async () => {
      const mockModule = { id: 'module-1', exercises: [] };
      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(mockModule);

       result = await learningService.getExercise('module-1', 'nonexistent');

      expect(result).toBeNull();
    });
  });
});