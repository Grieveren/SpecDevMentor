import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TemplateService, CreateTemplateRequest, SearchTemplatesRequest } from '../services/template.service';

// Mock Prisma Client
const mockPrisma = {
  template: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
  specificationProject: {
    findFirst: vi.fn(),
  },
  templateTeamShare: {
    count: vi.fn(),
    upsert: vi.fn(),
  },
  templateUsage: {
    create: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  },
  $transaction: vi.fn(),
} as unknown as PrismaClient;

describe('TemplateService', () => {
  let templateService: TemplateService;

  beforeEach(() => {
    templateService = new TemplateService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('createTemplate', () => {
    it('should create a template successfully', async () => {
      const templateData: CreateTemplateRequest = {
        name: 'Test Template',
        description: 'A test template',
        category: 'REQUIREMENTS' as any,
        content: 'Template content with {{variable}}',
        variables: [
          {
            name: 'variable',
            description: 'Test variable',
            type: 'text',
            required: true,
          },
        ],
        tags: ['test', 'example'],
        isPublic: false,
      };

      const mockTemplate = {
        id: 'template-1',
        ...templateData,
        authorId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.template.create as any).mockResolvedValue(mockTemplate);

      const _result = await templateService.createTemplate(templateData, 'user-1');

      expect(mockPrisma.template.create).toHaveBeenCalledWith({
        data: {
          ...templateData,
          authorId: 'user-1',
        },
      });
      expect(result).toEqual(mockTemplate);
    });

    it('should validate template data', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
        description: 'Test description',
        category: 'REQUIREMENTS' as any,
        content: 'Content',
      };

      await expect(
        templateService.createTemplate(invalidData as CreateTemplateRequest, 'user-1')
      ).rejects.toThrow();
    });
  });

  describe('updateTemplate', () => {
    it('should update template when user is the author', async () => {
      const templateId = 'template-1';
      const userId = 'user-1';
      const updateData = {
        name: 'Updated Template',
        description: 'Updated description',
      };

      const mockTemplate = {
        id: templateId,
        authorId: userId,
        author: { id: userId, name: 'Test User' },
      };

      const mockUpdatedTemplate = {
        ...mockTemplate,
        ...updateData,
      };

      (mockPrisma.template.findUnique as any).mockResolvedValue(mockTemplate);
      (mockPrisma.template.update as any).mockResolvedValue(mockUpdatedTemplate);

      const _result = await templateService.updateTemplate(templateId, updateData, userId);

      expect(mockPrisma.template.update).toHaveBeenCalledWith({
        where: { id: templateId },
        data: updateData,
      });
      expect(result).toEqual(mockUpdatedTemplate);
    });

    it('should allow admin to update any template', async () => {
      const templateId = 'template-1';
      const userId = 'admin-user';
      const authorId = 'other-user';
      const updateData = { name: 'Updated by Admin' };

      const mockTemplate = {
        id: templateId,
        authorId,
        author: { id: authorId, name: 'Other User' },
      };

      const mockAdminUser = {
        id: userId,
        role: 'ADMIN',
      };

      (mockPrisma.template.findUnique as any).mockResolvedValue(mockTemplate);
      (mockPrisma.user.findUnique as any).mockResolvedValue(mockAdminUser);
      (mockPrisma.template.update as any).mockResolvedValue({
        ...mockTemplate,
        ...updateData,
      });

      const _result = await templateService.updateTemplate(templateId, updateData, userId);

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
      });
      expect(result.name).toBe('Updated by Admin');
    });

    it('should throw error when non-author non-admin tries to update', async () => {
      const templateId = 'template-1';
      const userId = 'other-user';
      const authorId = 'template-author';

      const mockTemplate = {
        id: templateId,
        authorId,
        author: { id: authorId, name: 'Template Author' },
      };

      const mockUser = {
        id: userId,
        role: 'DEVELOPER',
      };

      (mockPrisma.template.findUnique as any).mockResolvedValue(mockTemplate);
      (mockPrisma.user.findUnique as any).mockResolvedValue(mockUser);

      await expect(
        templateService.updateTemplate(templateId, { name: 'Unauthorized Update' }, userId)
      ).rejects.toThrow('Insufficient permissions to update template');
    });

    it('should throw error when template not found', async () => {
      (mockPrisma.template.findUnique as any).mockResolvedValue(null);

      await expect(
        templateService.updateTemplate('nonexistent', { name: 'Update' }, 'user-1')
      ).rejects.toThrow('Template not found');
    });
  });

  describe('searchTemplates', () => {
    it('should search templates with filters', async () => {
      const userId = 'user-1';
      const searchParams: SearchTemplatesRequest = {
        query: 'test',
        category: 'REQUIREMENTS' as any,
        page: 1,
        limit: 10,
      };

      const mockTemplates = [
        {
          id: 'template-1',
          name: 'Test Template',
          category: 'REQUIREMENTS' as any,
          author: {
            id: 'user-1',
            name: 'Test User',
            email: 'test@example.com',
          },
          _count: { usages: 5 },
        },
      ];

      (mockPrisma.template.findMany as any).mockResolvedValue(mockTemplates);
      (mockPrisma.template.count as any).mockResolvedValue(1);

      const _result = await templateService.searchTemplates(searchParams, userId);

      expect(result.templates).toEqual(mockTemplates);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        pages: 1,
      });
    });

    it('should include public templates and user-accessible templates', async () => {
      const userId = 'user-1';
      const searchParams: SearchTemplatesRequest = {};

      (mockPrisma.template.findMany as any).mockResolvedValue([]);
      (mockPrisma.template.count as any).mockResolvedValue(0);

      await templateService.searchTemplates(searchParams, userId);

      const whereClause = (mockPrisma.template.findMany as any).mock.calls[0][0].where;
      
      expect(whereClause.OR).toContainEqual({ isPublic: true });
      expect(whereClause.OR).toContainEqual({ authorId: userId });
      expect(whereClause.OR).toContainEqual({
        teamShares: {
          some: {
            project: {
              OR: [
                { ownerId: userId },
                { team: { some: { userId, status: 'ACTIVE' } } },
              ],
            },
          },
        },
      });
    });
  });

  describe('applyTemplate', () => {
    it('should apply template with variable substitution', async () => {
      const templateId = 'template-1';
      const userId = 'user-1';
      const variables = { projectName: 'My Project', author: 'John Doe' };

      const mockTemplate = {
        id: templateId,
        content: 'Project: {{projectName}}\nAuthor: {{author}}',
        variables: [
          { name: 'projectName', required: true, type: 'text' },
          { name: 'author', required: false, type: 'text', defaultValue: 'Unknown' },
        ],
        isPublic: true,
        author: { id: 'author-1', name: 'Template Author', email: 'author@example.com' },
        _count: { usages: 0 },
      };

      (mockPrisma.template.findUnique as any).mockResolvedValue(mockTemplate);
      (mockPrisma.$transaction as any).mockImplementation(async (callback) => {
        return callback({
          templateUsage: { create: vi.fn() },
          template: { update: vi.fn() },
        });
      });

      const _result = await templateService.applyTemplate(
        { templateId, variables },
        userId
      );

      expect(result).toBe('Project: My Project\nAuthor: John Doe');
    });

    it('should throw error for missing required variables', async () => {
      const templateId = 'template-1';
      const userId = 'user-1';
      const variables = {}; // Missing required variable

      const mockTemplate = {
        id: templateId,
        content: 'Project: {{projectName}}',
        variables: [
          { name: 'projectName', required: true, type: 'text' },
        ],
        isPublic: true,
        author: { id: 'author-1', name: 'Template Author', email: 'author@example.com' },
        _count: { usages: 0 },
      };

      (mockPrisma.template.findUnique as any).mockResolvedValue(mockTemplate);

      await expect(
        templateService.applyTemplate({ templateId, variables }, userId)
      ).rejects.toThrow("Required variable 'projectName' is missing");
    });

    it('should use default values for optional variables', async () => {
      const templateId = 'template-1';
      const userId = 'user-1';
      const variables = { projectName: 'My Project' };

      const mockTemplate = {
        id: templateId,
        content: 'Project: {{projectName}}\nAuthor: {{author}}',
        variables: [
          { name: 'projectName', required: true, type: 'text' },
          { name: 'author', required: false, type: 'text', defaultValue: 'Unknown Author' },
        ],
        isPublic: true,
        author: { id: 'author-1', name: 'Template Author', email: 'author@example.com' },
        _count: { usages: 0 },
      };

      (mockPrisma.template.findUnique as any).mockResolvedValue(mockTemplate);
      (mockPrisma.$transaction as any).mockImplementation(async (callback) => {
        return callback({
          templateUsage: { create: vi.fn() },
          template: { update: vi.fn() },
        });
      });

      const _result = await templateService.applyTemplate(
        { templateId, variables },
        userId
      );

      expect(result).toBe('Project: My Project\nAuthor: Unknown Author');
    });
  });

  describe('shareTemplateWithTeam', () => {
    it('should share template with project team', async () => {
      const templateId = 'template-1';
      const projectId = 'project-1';
      const userId = 'user-1';
      const permission = 'READ' as any;

      const mockTemplate = {
        id: templateId,
        authorId: userId,
      };

      const mockProject = {
        id: projectId,
        ownerId: userId,
      };

      (mockPrisma.template.findUnique as any).mockResolvedValue(mockTemplate);
      (mockPrisma.specificationProject.findFirst as any).mockResolvedValue(mockProject);
      (mockPrisma.templateTeamShare.upsert as any).mockResolvedValue({});

      await templateService.shareTemplateWithTeam(templateId, projectId, permission, userId);

      expect(mockPrisma.templateTeamShare.upsert).toHaveBeenCalledWith({
        where: {
          templateId_projectId: {
            templateId,
            projectId,
          },
        },
        update: { permission },
        create: {
          templateId,
          projectId,
          permission,
        },
      });
    });

    it('should throw error when user is not template author', async () => {
      const templateId = 'template-1';
      const projectId = 'project-1';
      const userId = 'user-1';
      const authorId = 'other-user';

      const mockTemplate = {
        id: templateId,
        authorId,
      };

      (mockPrisma.template.findUnique as any).mockResolvedValue(mockTemplate);

      await expect(
        templateService.shareTemplateWithTeam(templateId, projectId, 'READ' as any, userId)
      ).rejects.toThrow('Only template author can share templates');
    });
  });

  describe('rateTemplate', () => {
    it('should rate template successfully', async () => {
      const templateId = 'template-1';
      const userId = 'user-1';
      const rating = 5;
      const feedback = 'Great template!';

      const mockTemplate = {
        id: templateId,
        isPublic: true,
        author: { id: 'author-1', name: 'Author', email: 'author@example.com' },
        _count: { usages: 0 },
      };

      (mockPrisma.template.findUnique as any).mockResolvedValue(mockTemplate);
      (mockPrisma.templateUsage.upsert as any).mockResolvedValue({});
      (mockPrisma.templateUsage.aggregate as any).mockResolvedValue({
        _avg: { rating: 4.5 },
      });
      (mockPrisma.template.update as any).mockResolvedValue({});

      await templateService.rateTemplate(templateId, rating, feedback, userId);

      expect(mockPrisma.templateUsage.upsert).toHaveBeenCalledWith({
        where: {
          templateId_userId: {
            templateId,
            userId,
          },
        },
        update: { rating, feedback },
        create: {
          templateId,
          userId,
          rating,
          feedback,
        },
      });
    });

    it('should throw error for invalid rating', async () => {
      await expect(
        templateService.rateTemplate('template-1', 6, undefined, 'user-1')
      ).rejects.toThrow('Rating must be between 1 and 5');

      await expect(
        templateService.rateTemplate('template-1', 0, undefined, 'user-1')
      ).rejects.toThrow('Rating must be between 1 and 5');
    });
  });
});