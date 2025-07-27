import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { BestPracticesService, CreateGuideRequest } from '../services/best-practices.service';

// Mock Prisma Client
const mockPrisma = {
  bestPracticeGuide: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
} as unknown as PrismaClient;

describe('BestPracticesService', () => {
  let bestPracticesService: BestPracticesService;

  beforeEach(() => {
    bestPracticesService = new BestPracticesService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('createGuide', () => {
    it('should create a best practice guide successfully', async () => {
      const guideData: CreateGuideRequest = {
        title: 'Requirements Best Practices',
        description: 'Guide for writing good requirements',
        phase: 'REQUIREMENTS',
        content: 'Best practices content...',
        tips: [
          {
            id: 'tip-1',
            title: 'Use EARS format',
            description: 'Use WHEN/IF/THEN structure',
            type: 'best-practice',
          },
        ],
        examples: [
          {
            id: 'example-1',
            title: 'User Story Example',
            description: 'How to write user stories',
            explanation: 'User stories should follow the format...',
          },
        ],
        isActive: true,
        priority: 1,
      };

      const mockGuide = {
        id: 'guide-1',
        ...guideData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.bestPracticeGuide.create as any).mockResolvedValue(mockGuide);

      const result = await bestPracticesService.createGuide(guideData);

      expect(mockPrisma.bestPracticeGuide.create).toHaveBeenCalledWith({
        data: {
          ...guideData,
          tips: guideData.tips,
          examples: guideData.examples,
        },
      });
      expect(result).toEqual(mockGuide);
    });

    it('should validate guide data', async () => {
      const invalidData = {
        title: '', // Invalid: empty title
        description: 'Test description',
        phase: 'REQUIREMENTS',
        content: 'Content',
      };

      await expect(
        bestPracticesService.createGuide(invalidData as CreateGuideRequest)
      ).rejects.toThrow();
    });
  });

  describe('getGuidesByPhase', () => {
    it('should return guides for a specific phase', async () => {
      const mockGuides = [
        {
          id: 'guide-1',
          title: 'Requirements Guide',
          phase: 'REQUIREMENTS',
          tips: [],
          examples: [],
          isActive: true,
          priority: 1,
        },
        {
          id: 'guide-2',
          title: 'Another Requirements Guide',
          phase: 'REQUIREMENTS',
          tips: [],
          examples: [],
          isActive: true,
          priority: 0,
        },
      ];

      (mockPrisma.bestPracticeGuide.findMany as any).mockResolvedValue(mockGuides);

      const result = await bestPracticesService.getGuidesByPhase('REQUIREMENTS');

      expect(mockPrisma.bestPracticeGuide.findMany).toHaveBeenCalledWith({
        where: {
          phase: 'REQUIREMENTS',
          isActive: true,
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'asc' },
        ],
      });
      expect(result).toHaveLength(2);
      expect(result[0].tips).toEqual([]);
      expect(result[0].examples).toEqual([]);
    });
  });

  describe('getContextualGuidance', () => {
    it('should return relevant tips and examples based on content', async () => {
      const mockGuides = [
        {
          id: 'guide-1',
          title: 'Requirements Guide',
          phase: 'REQUIREMENTS',
          tips: [
            {
              id: 'tip-1',
              title: 'Use user stories',
              description: 'Write user stories for better requirements',
              type: 'best-practice',
              trigger: {
                keywords: ['user story', 'as a'],
              },
            },
            {
              id: 'tip-2',
              title: 'Avoid vague language',
              description: 'Use specific language in requirements',
              type: 'warning',
              trigger: {
                keywords: ['should', 'might'],
              },
            },
          ],
          examples: [
            {
              id: 'example-1',
              title: 'User Story Format',
              description: 'Example of well-formatted user story',
              explanation: 'This shows the proper format',
            },
          ],
          isActive: true,
          priority: 1,
        },
      ];

      (mockPrisma.bestPracticeGuide.findMany as any).mockResolvedValue(mockGuides);

      const content = 'As a user, I want to login so that I can access my account';
      const result = await bestPracticesService.getContextualGuidance('REQUIREMENTS', content);

      expect(result.tips).toHaveLength(1);
      expect(result.tips[0].title).toBe('Use user stories');
      expect(result.examples).toHaveLength(1);
      expect(result.recommendations).toContain('Add acceptance criteria to make requirements testable');
    });

    it('should return recommendations based on content analysis', async () => {
      const mockGuides = [
        {
          id: 'guide-1',
          title: 'Requirements Guide',
          phase: 'REQUIREMENTS',
          tips: [],
          examples: [],
          isActive: true,
          priority: 1,
        },
      ];

      (mockPrisma.bestPracticeGuide.findMany as any).mockResolvedValue(mockGuides);

      const content = 'The system should handle user login';
      const result = await bestPracticesService.getContextualGuidance('REQUIREMENTS', content);

      expect(result.recommendations).toContain('Consider adding user stories to better capture user needs');
      expect(result.recommendations).toContain('Add acceptance criteria to make requirements testable');
    });
  });

  describe('analyzeDocumentQuality', () => {
    it('should analyze requirements document quality', async () => {
      (mockPrisma.bestPracticeGuide.findMany as any).mockResolvedValue([]);

      const content = `
        The system should handle user login.
        Users might want to reset passwords.
        The application could support multiple languages.
      `;

      const result = await bestPracticesService.analyzeDocumentQuality('REQUIREMENTS', content);

      expect(result.score).toBeLessThan(100);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            message: expect.stringContaining('should'),
          }),
          expect.objectContaining({
            type: 'warning',
            message: expect.stringContaining('might'),
          }),
          expect.objectContaining({
            type: 'warning',
            message: expect.stringContaining('could'),
          }),
        ])
      );
      expect(result.improvements).toContain('Use EARS format (WHEN/IF/THEN) for clearer acceptance criteria');
    });

    it('should analyze design document quality', async () => {
      (mockPrisma.bestPracticeGuide.findMany as any).mockResolvedValue([]);

      const content = 'This is a basic design document without architecture details.';
      const result = await bestPracticesService.analyzeDocumentQuality('DESIGN', content);

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            message: 'Define system components and their responsibilities',
          }),
          expect.objectContaining({
            message: 'Specify data models and storage design',
          }),
          expect.objectContaining({
            message: 'Document API interfaces and contracts',
          }),
        ])
      );
      expect(result.improvements).toContain('Include error handling strategy in the design');
    });

    it('should analyze tasks document quality', async () => {
      (mockPrisma.bestPracticeGuide.findMany as any).mockResolvedValue([]);

      const content = `
        - Implement login
        - Create database
      `;

      const result = await bestPracticesService.analyzeDocumentQuality('TASKS', content);

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            message: 'Consider breaking down work into more specific tasks',
          }),
        ])
      );
      expect(result.improvements).toContain('Include testing tasks to ensure quality');
    });

    it('should analyze implementation document quality', async () => {
      (mockPrisma.bestPracticeGuide.findMany as any).mockResolvedValue([]);

      const content = 'Implementation will involve coding the features.';
      const result = await bestPracticesService.analyzeDocumentQuality('IMPLEMENTATION', content);

      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'warning',
            message: 'Implementation should include testing strategy',
          }),
        ])
      );
      expect(result.improvements).toContain('Include code review process in implementation workflow');
      expect(result.improvements).toContain('Consider deployment strategy and environment setup');
    });
  });

  describe('updateGuide', () => {
    it('should update a guide successfully', async () => {
      const guideId = 'guide-1';
      const updateData = {
        title: 'Updated Guide Title',
        description: 'Updated description',
      };

      const mockUpdatedGuide = {
        id: guideId,
        ...updateData,
        phase: 'REQUIREMENTS',
        content: 'Content',
        tips: [],
        examples: [],
        isActive: true,
        priority: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.bestPracticeGuide.update as any).mockResolvedValue(mockUpdatedGuide);

      const result = await bestPracticesService.updateGuide(guideId, updateData);

      expect(mockPrisma.bestPracticeGuide.update).toHaveBeenCalledWith({
        where: { id: guideId },
        data: updateData,
      });
      expect(result).toEqual(mockUpdatedGuide);
    });
  });

  describe('deleteGuide', () => {
    it('should delete a guide successfully', async () => {
      const guideId = 'guide-1';

      (mockPrisma.bestPracticeGuide.delete as any).mockResolvedValue({});

      await bestPracticesService.deleteGuide(guideId);

      expect(mockPrisma.bestPracticeGuide.delete).toHaveBeenCalledWith({
        where: { id: guideId },
      });
    });
  });
});