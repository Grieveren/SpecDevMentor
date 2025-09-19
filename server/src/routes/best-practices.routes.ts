import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
import { BestPracticesService } from '../services/best-practices.service';
import { z } from 'zod';

const router: ExpressRouter = Router();
const prisma = new PrismaClient();
const bestPracticesService = new BestPracticesService(prisma);

// Validation schemas
const createGuideSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  phase: z.enum(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION']),
  content: z.string().min(1),
  tips: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    type: z.enum(['tip', 'warning', 'best-practice', 'example']),
    trigger: z.object({
      keywords: z.array(z.string()).optional(),
      patterns: z.array(z.string()).optional(),
      context: z.string().optional(),
    }).optional(),
  })).default([]),
  examples: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    goodExample: z.string().optional(),
    badExample: z.string().optional(),
    explanation: z.string(),
  })).default([]),
  isActive: z.boolean().default(true),
  priority: z.number().default(0),
});

const updateGuideSchema = createGuideSchema.partial();

const analyzeQualitySchema = z.object({
  phase: z.enum(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION']),
  content: z.string().min(1),
});

const getGuidanceSchema = z.object({
  phase: z.enum(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION']),
  content: z.string().min(1),
  context: z.string().optional(),
});

// Create best practice guide (admin only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can create best practice guides',
      });
    }

    const validatedData = createGuideSchema.parse(req.body);
    const guide = await bestPracticesService.createGuide(validatedData);

    res.status(201).json({
      success: true,
      data: guide,
    });
  } catch (error) {
    console.error('Create guide error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to create guide',
    });
  }
});

// Get all guides
router.get('/', authenticateToken, async (req, res) => {
  try {
    const guides = await bestPracticesService.getAllGuides();

    res.json({
      success: true,
      data: guides,
    });
  } catch (error) {
    console.error('Get guides error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get guides',
    });
  }
});

// Get guides by phase
router.get('/phase/:phase', authenticateToken, async (req, res) => {
  try {
    const { phase } = req.params;
    
    if (!['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION'].includes(phase)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phase',
      });
    }

    const guides = await bestPracticesService.getGuidesByPhase(phase as any);

    res.json({
      success: true,
      data: guides,
    });
  } catch (error) {
    console.error('Get guides by phase error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get guides',
    });
  }
});

// Get guide by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const guide = await bestPracticesService.getGuide(id);

    if (!guide) {
      return res.status(404).json({
        success: false,
        message: 'Guide not found',
      });
    }

    res.json({
      success: true,
      data: guide,
    });
  } catch (error) {
    console.error('Get guide error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get guide',
    });
  }
});

// Update guide (admin only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can update best practice guides',
      });
    }

    const { id } = req.params;
    const validatedData = updateGuideSchema.parse(req.body);
    const guide = await bestPracticesService.updateGuide(id, validatedData);

    res.json({
      success: true,
      data: guide,
    });
  } catch (error) {
    console.error('Update guide error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to update guide',
    });
  }
});

// Delete guide (admin only)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user!.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        message: 'Only administrators can delete best practice guides',
      });
    }

    const { id } = req.params;
    await bestPracticesService.deleteGuide(id);

    res.json({
      success: true,
      message: 'Guide deleted successfully',
    });
  } catch (error) {
    console.error('Delete guide error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to delete guide',
    });
  }
});

// Get contextual guidance
router.post('/guidance', authenticateToken, async (req, res) => {
  try {
    const validatedData = getGuidanceSchema.parse(req.body);
    const guidance = await bestPracticesService.getContextualGuidance(
      validatedData.phase,
      validatedData.content,
      validatedData.context
    );

    res.json({
      success: true,
      data: guidance,
    });
  } catch (error) {
    console.error('Get guidance error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to get guidance',
    });
  }
});

// Analyze document quality
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const validatedData = analyzeQualitySchema.parse(req.body);
    const analysis = await bestPracticesService.analyzeDocumentQuality(
      validatedData.phase,
      validatedData.content
    );

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('Analyze quality error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to analyze document',
    });
  }
});

export default router;