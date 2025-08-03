// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

interface Template {
  id: string;
  authorId: string;
  isPublic: boolean;
  variables: unknown;
  content: string;
  [key: string]: any;
}

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1),
  phase: z.enum(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION']).optional(),
  category: z.enum(['REQUIREMENTS', 'DESIGN', 'TASKS', 'GENERAL', 'DOMAIN_SPECIFIC']),
  content: z.string().min(1),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    type: z.enum(['text', 'number', 'boolean', 'select']),
    required: z.boolean().default(false),
    defaultValue: z.string().optional(),
    options: z.array(z.string()).optional(),
  })).default([]),
  tags: z.array(z.string()).default([]),
  isPublic: z.boolean().default(false),
});

const updateTemplateSchema = createTemplateSchema.partial();

const searchTemplatesSchema = z.object({
  query: z.string().optional(),
  phase: z.enum(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION']).optional(),
  category: z.enum(['REQUIREMENTS', 'DESIGN', 'TASKS', 'GENERAL', 'DOMAIN_SPECIFIC']).optional(),
  tags: z.array(z.string()).optional(),
  authorId: z.string().optional(),
  isPublic: z.boolean().optional(),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
  sortBy: z.enum(['name', 'createdAt', 'usageCount', 'rating']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  required: boolean;
  defaultValue?: string;
  options?: string[];
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  phase?: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  category: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'GENERAL' | 'DOMAIN_SPECIFIC';
  content: string;
  variables?: TemplateVariable[];
  tags?: string[];
  isPublic?: boolean;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {}

export interface SearchTemplatesRequest {
  query?: string;
  phase?: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  category?: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'GENERAL' | 'DOMAIN_SPECIFIC';
  tags?: string[];
  authorId?: string;
  isPublic?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'usageCount' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export type TemplateWithAuthor = Template & {
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  _count: {
    usages: number;
  };
};

export interface PaginatedTemplates {
  templates: TemplateWithAuthor[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApplyTemplateRequest {
  templateId: string;
  variables: Record<string, string>;
  projectId?: string;
}

export class TemplateService {
  constructor(private prisma: PrismaClient) {}

  async createTemplate(data: CreateTemplateRequest, authorId: string): Promise<Template> {
    const validatedData = createTemplateSchema.parse(data);

    const template = await this.prisma.template.create({
      data: {
        ...validatedData,
        authorId,
      },
    });

    return template;
  }

  async updateTemplate(
    templateId: string,
    data: UpdateTemplateRequest,
    userId: string
  ): Promise<Template> {
    const validatedData = updateTemplateSchema.parse(data);

    // Check if user owns the template or has admin permissions
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: { author: true },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.authorId !== userId) {
      // Check if user has admin role
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.role !== 'ADMIN') {
        throw new Error('Insufficient permissions to update template');
      }
    }

    const updatedTemplate = await this.prisma.template.update({
      where: { id: templateId },
      data: validatedData,
    });

    return updatedTemplate;
  }

  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    // Check permissions similar to update
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: { author: true },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.authorId !== userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user || user.role !== 'ADMIN') {
        throw new Error('Insufficient permissions to delete template');
      }
    }

    await this.prisma.template.delete({
      where: { id: templateId },
    });
  }

  async getTemplate(templateId: string, userId: string): Promise<TemplateWithAuthor | null> {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            usages: true,
          },
        },
      },
    });

    if (!template) {
      return null;
    }

    // Check if user has access to the template
    if (!template.isPublic && template.authorId !== userId) {
      // Check if template is shared with user's projects
      const hasAccess = await this.checkTemplateAccess(templateId, userId);
      if (!hasAccess) {
        throw new Error('Access denied to template');
      }
    }

    return template;
  }

  async searchTemplates(
    params: SearchTemplatesRequest,
    userId: string
  ): Promise<PaginatedTemplates> {
    const validatedParams = searchTemplatesSchema.parse(params);
    const { query, phase, category, tags, authorId, isPublic, page, limit, sortBy, sortOrder } = validatedParams;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      OR: [
        { isPublic: true },
        { authorId: userId },
        {
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
        },
      ],
    };

    if (query) {
      where.OR = [
        { name: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { hasSome: [query] } },
      ];
    }

    if (phase) {
      where.phase = phase;
    }

    if (category) {
      where.category = category;
    }

    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
    }

    if (authorId) {
      where.authorId = authorId;
    }

    if (isPublic !== undefined) {
      where.isPublic = isPublic;
    }

    // Build order by clause
    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    const [templates, total] = await Promise.all([
      this.prisma.template.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          author: {
            select: {
              id: true,
              name: true,
              email: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              usages: true,
            },
          },
        },
      }),
      this.prisma.template.count({ where }),
    ]);

    return {
      templates,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async applyTemplate(
    request: ApplyTemplateRequest,
    userId: string
  ): Promise<string> {
    const { templateId, variables, projectId } = request;

    // Get template and check access
    const template = await this.getTemplate(templateId, userId);
    if (!template) {
      throw new Error('Template not found or access denied');
    }

    // Parse template variables
    const templateVariables = template.variables as TemplateVariable[];
    
    // Validate required variables
    for (const variable of templateVariables) {
      if (variable.required && !variables[variable.name]) {
        throw new Error(`Required variable '${variable.name}' is missing`);
      }
    }

    // Apply variable substitution
    let processedContent = template.content;
    
    for (const variable of templateVariables) {
      const value = variables[variable.name] || variable.defaultValue || '';
      const placeholder = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g');
      processedContent = processedContent.replace(placeholder, value);
    }

    // Record template usage
    await this.recordTemplateUsage(templateId, userId, projectId);

    return processedContent;
  }

  async shareTemplateWithTeam(
    templateId: string,
    projectId: string,
    permission: 'READ' | 'WRITE' | 'ADMIN',
    userId: string
  ): Promise<void> {
    // Check if user owns the template
    const template = await this.prisma.template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error('Template not found');
    }

    if (template.authorId !== userId) {
      throw new Error('Only template author can share templates');
    }

    // Check if user has access to the project
    const project = await this.prisma.specificationProject.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { team: { some: { userId, status: 'ACTIVE' } } },
        ],
      },
    });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Create or update share
    await this.prisma.templateTeamShare.upsert({
      where: {
        templateId_projectId: {
          templateId,
          projectId,
        },
      },
      update: {
        permission,
      },
      create: {
        templateId,
        projectId,
        permission,
      },
    });
  }

  async rateTemplate(
    templateId: string,
    rating: number,
    feedback: string | undefined,
    userId: string
  ): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Check if template exists and user has access
    const template = await this.getTemplate(templateId, userId);
    if (!template) {
      throw new Error('Template not found or access denied');
    }

    // Create or update rating
    await this.prisma.templateUsage.upsert({
      where: {
        templateId_userId: {
          templateId,
          userId,
        },
      },
      update: {
        rating,
        feedback,
      },
      create: {
        templateId,
        userId,
        rating,
        feedback,
      },
    });

    // Update template average rating
    await this.updateTemplateRating(templateId);
  }

  async getTemplatesByProject(projectId: string, userId: string): Promise<TemplateWithAuthor[]> {
    // Check project access
    const project = await this.prisma.specificationProject.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { team: { some: { userId, status: 'ACTIVE' } } },
        ],
      },
    });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const templates = await this.prisma.template.findMany({
      where: {
        teamShares: {
          some: {
            projectId,
          },
        },
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            usages: true,
          },
        },
      },
    });

    return templates;
  }

  private async checkTemplateAccess(templateId: string, userId: string): Promise<boolean> {
    const shareCount = await this.prisma.templateTeamShare.count({
      where: {
        templateId,
        project: {
          OR: [
            { ownerId: userId },
            { team: { some: { userId, status: 'ACTIVE' } } },
          ],
        },
      },
    });

    return shareCount > 0;
  }

  private async recordTemplateUsage(
    templateId: string,
    userId: string,
    projectId?: string
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Create usage record
      await tx.templateUsage.create({
        data: {
          templateId,
          userId,
          projectId,
        },
      });

      // Increment usage count
      await tx.template.update({
        where: { id: templateId },
        data: {
          usageCount: {
            increment: 1,
          },
        },
      });
    });
  }

  private async updateTemplateRating(templateId: string): Promise<void> {
    const result = await this.prisma.templateUsage.aggregate({
      where: {
        templateId,
        rating: { not: null },
      },
      _avg: {
        rating: true,
      },
    });

    const averageRating = result._avg.rating || 0;

    await this.prisma.template.update({
      where: { id: templateId },
      data: {
        rating: averageRating,
      },
    });
  }
}