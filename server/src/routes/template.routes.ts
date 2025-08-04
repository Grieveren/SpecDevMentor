// @ts-nocheck
import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import { TemplateService } from '../services/template.service';
import { z } from 'zod';

const router: ExpressRouter = Router();
const prisma = new PrismaClient();
const templateService = new TemplateService(prisma);

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

const applyTemplateSchema = z.object({
  templateId: z.string(),
  variables: z.record(z.string()),
  projectId: z.string().optional(),
});

const shareTemplateSchema = z.object({
  projectId: z.string(),
  permission: z.enum(['READ', 'write', 'admin']).default('read'),
});

const rateTemplateSchema = z.object({
  rating: z.number().min(1).max(5),
  feedback: z.string().optional(),
});

// Create template
router.post('/', authenticateToken, async (req, res) => {
  try {
    const validatedData = createTemplateSchema.parse(req.body);
    const userId = req.user!.id;

    const template = await templateService.createTemplate(validatedData, userId);

    res.status(201).json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Create template error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create template',
    });
  }
});

// Get templates with search and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const {
      query,
      phase,
      category,
      tags,
      authorId,
      isPublic,
      page = '1',
      limit = '20',
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const searchParams = {
      query: query as string,
      phase: phase as any,
      category: category as any,
      tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
      authorId: authorId as string,
      isPublic: isPublic === 'true' ? true : isPublic === 'false' ? false : undefined,
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    };

    const _result = await templateService.searchTemplates(searchParams, userId);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Search templates error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to search templates',
    });
  }
});

// Get template by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    const template = await templateService.getTemplate(id, userId);

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found',
      });
    }

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Get template error:', error);
    
    if (error instanceof Error && error.message === 'Access denied to template') {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get template',
    });
  }
});

// Update template
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const validatedData = updateTemplateSchema.parse(req.body);

    const template = await templateService.updateTemplate(id, validatedData, userId);

    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    console.error('Update template error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    if (error instanceof Error) {
      if (error.message === 'Template not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      
      if (error.message === 'Insufficient permissions to update template') {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update template',
    });
  }
});

// Delete template
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;

    await templateService.deleteTemplate(id, userId);

    res.json({
      success: true,
      message: 'Template deleted successfully',
    });
  } catch (error) {
    console.error('Delete template error:', error);
    
    if (error instanceof Error) {
      if (error.message === 'Template not found') {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      
      if (error.message === 'Insufficient permissions to delete template') {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete template',
    });
  }
});

// Apply template
router.post('/apply', authenticateToken, async (req, res) => {
  try {
    const userId = req.user!.id;
    const validatedData = applyTemplateSchema.parse(req.body);

    const processedContent = await templateService.applyTemplate(validatedData, userId);

    res.json({
      success: true,
      data: {
        content: processedContent,
      },
    });
  } catch (error) {
    console.error('Apply template error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to apply template',
    });
  }
});

// Share template with team
router.post('/:id/share', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const validatedData = shareTemplateSchema.parse(req.body);

    await templateService.shareTemplateWithTeam(
      id,
      validatedData.projectId,
      validatedData.permission as any,
      userId
    );

    res.json({
      success: true,
      message: 'Template shared successfully',
    });
  } catch (error) {
    console.error('Share template error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          message: error.message,
        });
      }
      
      if (error.message.includes('permissions') || error.message.includes('access denied')) {
        return res.status(403).json({
          success: false,
          message: error.message,
        });
      }
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to share template',
    });
  }
});

// Rate template
router.post('/:id/rate', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user!.id;
    const validatedData = rateTemplateSchema.parse(req.body);

    await templateService.rateTemplate(
      id,
      validatedData.rating,
      validatedData.feedback,
      userId
    );

    res.json({
      success: true,
      message: 'Template rated successfully',
    });
  } catch (error) {
    console.error('Rate template error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to rate template',
    });
  }
});

// Get templates shared with project
router.get('/project/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.id;

    const templates = await templateService.getTemplatesByProject(projectId, userId);

    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    console.error('Get project templates error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get project templates',
    });
  }
});

export default router;