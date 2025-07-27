import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
    upsert: vi.fn(),
  },
} as unknown as PrismaClient;

describe('Learning Assessment Integration', () => {
  let learningService: LearningService;

  beforeEach(() => {
    learningService = new LearningService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('Exercise Evaluation Workflow', () => {
    const mockModule = {
      id: 'module-1',
      title: 'Requirements Engineering',
      exercises: [
        {
          id: 'exercise-1',
          type: 'multiple_choice',
          title: 'Requirements Quiz',
          points: 10,
          metadata: {
            correctAnswer: 'b',
            explanation: 'EARS format requires WHEN/IF/THEN structure',
          },
        },
        {
          id: 'exercise-2',
          type: 'specification_writing',
          title: 'Write a Requirement',
          points: 20,
          metadata: {
            minLength: 50,
            requiredConcepts: ['user story', 'acceptance criteria'],
          },
        },
      ],
    };

    beforeEach(() => {
      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(mockModule);
    });

    it('should evaluate multiple choice exercise correctly', async () => {
      const userId = 'user-1';
      const moduleId = 'module-1';
      const exerciseId = 'exercise-1';
      const correctResponse = 'b';

      mockPrisma.userProgress.findUnique = vi.fn().mockResolvedValue(null);
      mockPrisma.userProgress.upsert = vi.fn().mockResolvedValue({});

      const result = await learningService.evaluateExercise(
        userId,
        moduleId,
        exerciseId,
        correctResponse
      );

      expect(result).toMatchObject({
        exerciseId,
        score: 10,
        maxScore: 10,
        attempts: 1,
        feedback: 'Correct! Well done.',
      });

      expect(mockPrisma.userProgress.upsert).toHaveBeenCalledWith({
        where: { userId_moduleId: { userId, moduleId } },
        create: expect.objectContaining({
          userId,
          moduleId,
          status: ProgressStatus.IN_PROGRESS,
          exerciseResults: expect.arrayContaining([
            expect.objectContaining({
              exerciseId,
              score: 10,
              maxScore: 10,
            }),
          ]),
        }),
        update: expect.objectContaining({
          exerciseResults: expect.arrayContaining([
            expect.objectContaining({
              exerciseId,
              score: 10,
              maxScore: 10,
            }),
          ]),
        }),
      });
    });

    it('should evaluate incorrect multiple choice response', async () => {
      const userId = 'user-1';
      const moduleId = 'module-1';
      const exerciseId = 'exercise-1';
      const incorrectResponse = 'a';

      mockPrisma.userProgress.findUnique = vi.fn().mockResolvedValue(null);
      mockPrisma.userProgress.upsert = vi.fn().mockResolvedValue({});

      const result = await learningService.evaluateExercise(
        userId,
        moduleId,
        exerciseId,
        incorrectResponse
      );

      expect(result).toMatchObject({
        exerciseId,
        score: 0,
        maxScore: 10,
        attempts: 1,
        feedback: expect.stringContaining('Incorrect'),
      });
    });

    it('should evaluate specification writing exercise', async () => {
      const userId = 'user-1';
      const moduleId = 'module-1';
      const exerciseId = 'exercise-2';
      const response = 'As a user, I want to login so that I can access my account. WHEN user enters valid credentials THEN system SHALL authenticate user.';

      mockPrisma.userProgress.findUnique = vi.fn().mockResolvedValue(null);
      mockPrisma.userProgress.upsert = vi.fn().mockResolvedValue({});

      const result = await learningService.evaluateExercise(
        userId,
        moduleId,
        exerciseId,
        response
      );

      expect(result.score).toBeGreaterThan(0);
      expect(result.maxScore).toBe(20);
      expect(result.feedback).toContain('EARS format');
      expect(result.feedback).toContain('user story');
    });

    it('should track multiple attempts correctly', async () => {
      const userId = 'user-1';
      const moduleId = 'module-1';
      const exerciseId = 'exercise-1';

      const existingProgress = {
        exerciseResults: [
          {
            exerciseId,
            score: 0,
            maxScore: 10,
            attempts: 1,
            completedAt: new Date(),
            timeSpent: 5,
          },
        ],
      };

      mockPrisma.userProgress.findUnique = vi.fn().mockResolvedValue(existingProgress);
      mockPrisma.userProgress.upsert = vi.fn().mockResolvedValue({});

      const result = await learningService.evaluateExercise(
        userId,
        moduleId,
        exerciseId,
        'b'
      );

      expect(result.attempts).toBe(2);
    });
  });

  describe('Skill Assessment Workflow', () => {
    const mockModule = {
      id: 'module-1',
      difficulty: DifficultyLevel.BEGINNER,
      phase: SpecificationPhase.REQUIREMENTS,
    };

    beforeEach(() => {
      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(mockModule);
    });

    it('should assess skill and update progress', async () => {
      const userId = 'user-1';
      const moduleId = 'module-1';
      const skillId = 'requirements-analysis';
      const responses = {
        clarity: 3,
        testability: 4,
        completeness: 2,
      };

      const existingProgress = {
        id: 'progress-1',
        skillAssessments: [],
      };

      mockPrisma.userProgress.findUnique = vi.fn().mockResolvedValue(existingProgress);
      mockPrisma.userProgress.update = vi.fn().mockResolvedValue({});

      const result = await learningService.assessSkill(
        userId,
        moduleId,
        skillId,
        responses
      );

      expect(result).toMatchObject({
        skillId,
        skillName: 'Requirements Analysis',
        level: DifficultyLevel.BEGINNER,
        score: expect.any(Number),
        maxScore: expect.any(Number),
        competencies: expect.arrayContaining([
          expect.objectContaining({
            competencyId: 'clarity',
            name: 'Clarity and Precision',
            score: expect.any(Number),
            feedback: expect.any(String),
          }),
        ]),
      });

      expect(mockPrisma.userProgress.update).toHaveBeenCalledWith({
        where: { userId_moduleId: { userId, moduleId } },
        data: expect.objectContaining({
          skillAssessments: expect.arrayContaining([
            expect.objectContaining({
              skillId,
              skillName: 'Requirements Analysis',
            }),
          ]),
        }),
      });
    });
  });

  describe('Skill Development Tracking', () => {
    it('should track skill development across modules', async () => {
      const userId = 'user-1';
      const mockProgress = [
        {
          id: 'progress-1',
          userId,
          moduleId: 'module-1',
          status: ProgressStatus.COMPLETED,
          skillAssessments: [
            {
              skillId: 'requirements-analysis',
              skillName: 'Requirements Analysis',
              level: 'BEGINNER',
              score: 8,
              maxScore: 10,
              assessedAt: new Date('2023-01-01'),
              competencies: [
                {
                  competencyId: 'clarity',
                  name: 'Clarity and Precision',
                  score: 3,
                  maxScore: 4,
                  feedback: 'Good work',
                },
              ],
            },
          ],
          module: {
            id: 'module-1',
            title: 'Requirements Basics',
            phase: 'REQUIREMENTS',
            difficulty: 'BEGINNER',
          },
        },
        {
          id: 'progress-2',
          userId,
          moduleId: 'module-2',
          status: ProgressStatus.IN_PROGRESS,
          skillAssessments: [
            {
              skillId: 'requirements-analysis',
              skillName: 'Requirements Analysis',
              level: 'INTERMEDIATE',
              score: 6,
              maxScore: 10,
              assessedAt: new Date('2023-01-15'),
              competencies: [
                {
                  competencyId: 'clarity',
                  name: 'Clarity and Precision',
                  score: 2,
                  maxScore: 4,
                  feedback: 'Needs improvement',
                },
              ],
            },
          ],
          module: {
            id: 'module-2',
            title: 'Advanced Requirements',
            phase: 'REQUIREMENTS',
            difficulty: 'INTERMEDIATE',
          },
        },
      ];

      mockPrisma.userProgress.findMany = vi.fn().mockResolvedValue(mockProgress);

      const development = await learningService.getSkillDevelopment(userId);

      expect(development).toMatchObject({
        userId,
        skillLevels: expect.arrayContaining([
          expect.objectContaining({
            skillId: 'requirements-analysis',
            skillName: 'Requirements Analysis',
            progression: expect.arrayContaining([
              expect.objectContaining({
                score: 80, // 8/10 * 100
                level: 'BEGINNER',
              }),
              expect.objectContaining({
                score: 60, // 6/10 * 100
                level: 'INTERMEDIATE',
              }),
            ]),
            averageScore: 70, // (80 + 60) / 2
            assessmentCount: 2,
          }),
        ]),
        competencyScores: expect.arrayContaining([
          expect.objectContaining({
            competencyId: 'clarity',
            name: 'Clarity and Precision',
            scores: expect.arrayContaining([
              expect.objectContaining({ score: 75 }), // 3/4 * 100
              expect.objectContaining({ score: 50 }), // 2/4 * 100
            ]),
            averageScore: 62.5, // (75 + 50) / 2
            trend: 'declining',
          }),
        ]),
        overallProgress: {
          completedModules: 1,
          totalModules: 2,
          averageScore: 70,
        },
        improvementAreas: ['Requirements Analysis'], // Score < 60 in latest assessment
        strengths: [],
      });
    });
  });

  describe('Personalized Feedback Generation', () => {
    it('should generate personalized feedback with recommendations', async () => {
      const userId = 'user-1';
      
      // Mock skill development data
      const mockSkillDevelopment = {
        userId,
        skillLevels: [
          {
            skillId: 'requirements-analysis',
            skillName: 'Requirements Analysis',
            currentLevel: DifficultyLevel.BEGINNER,
            progression: [],
            averageScore: 45, // Low score for improvement recommendation
            assessmentCount: 3,
          },
          {
            skillId: 'design-patterns',
            skillName: 'Design Patterns',
            currentLevel: DifficultyLevel.INTERMEDIATE,
            progression: [],
            averageScore: 92, // High score for achievement
            assessmentCount: 2,
          },
        ],
        competencyScores: [
          {
            competencyId: 'clarity',
            name: 'Clarity and Precision',
            scores: [
              { score: 60, date: new Date('2023-01-01') },
              { score: 70, date: new Date('2023-01-15') },
              { score: 80, date: new Date('2023-02-01') },
            ],
            averageScore: 70,
            trend: 'improving' as const,
          },
        ],
        overallProgress: {
          completedModules: 2,
          totalModules: 5,
          averageScore: 68.5,
        },
        strengths: ['Design Patterns'],
        improvementAreas: ['Requirements Analysis'],
        lastUpdated: new Date(),
      };

      // Mock the getSkillDevelopment method
      vi.spyOn(learningService, 'getSkillDevelopment').mockResolvedValue(mockSkillDevelopment);
      
      // Mock getRecommendedModules
      vi.spyOn(learningService, 'getRecommendedModules').mockResolvedValue([
        {
          id: 'module-3',
          title: 'Advanced Requirements',
          description: 'Next level requirements',
          difficulty: DifficultyLevel.INTERMEDIATE,
          prerequisites: [],
          content: [],
          exercises: [],
          estimatedDuration: 60,
          isPublished: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const feedback = await learningService.getPersonalizedFeedback(userId);

      expect(feedback).toMatchObject({
        userId,
        recommendations: expect.arrayContaining([
          expect.objectContaining({
            type: 'improvement',
            title: 'Improve Requirements Analysis',
            priority: 'high',
          }),
          expect.objectContaining({
            type: 'encouragement',
            title: 'Great Progress in Clarity and Precision',
            priority: 'medium',
          }),
          expect.objectContaining({
            type: 'next_steps',
            title: 'Continue Your Learning Journey',
            priority: 'medium',
          }),
        ]),
        achievements: expect.arrayContaining([
          expect.objectContaining({
            title: 'Design Patterns Mastery',
            category: 'mastery',
            points: 100,
          }),
        ]),
        overallFeedback: expect.stringContaining('completed 2 out of 5 modules'),
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle module not found in exercise evaluation', async () => {
      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        learningService.evaluateExercise('user-1', 'nonexistent', 'exercise-1', 'response')
      ).rejects.toThrow('Learning module not found');
    });

    it('should handle exercise not found in module', async () => {
      const mockModule = {
        id: 'module-1',
        exercises: [],
      };

      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(mockModule);

      await expect(
        learningService.evaluateExercise('user-1', 'module-1', 'nonexistent', 'response')
      ).rejects.toThrow('Exercise not found');
    });

    it('should handle skill assessment for nonexistent module', async () => {
      mockPrisma.learningModule.findUnique = vi.fn().mockResolvedValue(null);

      await expect(
        learningService.assessSkill('user-1', 'nonexistent', 'skill-1', {})
      ).rejects.toThrow('Learning module not found');
    });
  });
});