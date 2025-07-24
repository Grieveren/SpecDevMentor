import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { authenticateToken } from '../middleware/auth.middleware';
import { SpecificationWorkflowService } from '../services/specification-workflow.service';

const router = Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const workflowService = new SpecificationWorkflowService(prisma, redis);

// Validate phase completion
router.get('/projects/:projectId/workflow/validate/:phase', authenticateToken, async (req, res) => {
  try {
    const { projectId, phase } = req.params;
    const userId = req.user.id;

    // Check if user has access to project
    const project = await prisma.specificationProject.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { team: { some: { userId, status: 'ACTIVE' } } },
        ],
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const validation = await workflowService.validatePhaseCompletion(
      projectId,
      phase as any
    );

    res.json(validation);
  } catch (error) {
    console.error('Phase validation error:', error);
    res.status(500).json({ error: 'Failed to validate phase completion' });
  }
});

// Get workflow state
router.get('/projects/:projectId/workflow/state', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user.id;

    // Check if user has access to project
    const project = await prisma.specificationProject.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { team: { some: { userId, status: 'ACTIVE' } } },
        ],
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const workflowState = await workflowService.getWorkflowState(projectId);

    // Add user names to approvals and phase history
    const userIds = new Set<string>();
    
    // Collect user IDs from phase history
    workflowState.phaseHistory.forEach(transition => {
      userIds.add(transition.userId);
    });
    
    // Collect user IDs from approvals
    Object.values(workflowState.approvals).forEach(approvals => {
      approvals.forEach(approval => {
        userIds.add(approval.userId);
      });
    });

    // Fetch user information
    const users = await prisma.user.findMany({
      where: { id: { in: Array.from(userIds) } },
      select: { id: true, name: true, email: true, avatar: true },
    });

    const userMap = new Map(users.map(user => [user.id, user]));

    // Add user names to phase history
    const enrichedPhaseHistory = workflowState.phaseHistory.map(transition => ({
      ...transition,
      userName: userMap.get(transition.userId)?.name || 'Unknown User',
    }));

    // Add user names to approvals
    const enrichedApprovals: any = {};
    Object.keys(workflowState.approvals).forEach(phase => {
      enrichedApprovals[phase] = workflowState.approvals[phase as any].map(approval => ({
        ...approval,
        userName: userMap.get(approval.userId)?.name || 'Unknown User',
      }));
    });

    res.json({
      ...workflowState,
      phaseHistory: enrichedPhaseHistory,
      approvals: enrichedApprovals,
    });
  } catch (error) {
    console.error('Get workflow state error:', error);
    res.status(500).json({ error: 'Failed to get workflow state' });
  }
});

// Request phase approval
router.post('/projects/:projectId/workflow/approve', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { phase, comment } = req.body;
    const userId = req.user.id;

    // Check if user has access to project
    const project = await prisma.specificationProject.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { team: { some: { userId, status: 'ACTIVE' } } },
        ],
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    await workflowService.approvePhase(projectId, phase, userId, comment);

    res.json({ success: true, message: 'Approval recorded successfully' });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Failed to record approval' });
  }
});

// Transition to next phase
router.post('/projects/:projectId/workflow/transition', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    const { targetPhase, approvalComment } = req.body;
    const userId = req.user.id;

    // Check if user has access to project
    const project = await prisma.specificationProject.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { team: { some: { userId, status: 'ACTIVE' } } },
        ],
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const workflowState = await workflowService.transitionPhase(
      projectId,
      { targetPhase, approvalComment },
      userId
    );

    res.json({
      success: true,
      message: `Successfully transitioned to ${targetPhase}`,
      workflowState,
    });
  } catch (error) {
    console.error('Phase transition error:', error);
    
    if (error.name === 'SpecificationWorkflowError') {
      return res.status(error.statusCode || 400).json({
        error: error.message,
        code: error.code,
        phase: error.phase,
      });
    }
    
    res.status(500).json({ error: 'Failed to transition phase' });
  }
});

// Update document content
router.put('/projects/:projectId/workflow/documents/:phase', authenticateToken, async (req, res) => {
  try {
    const { projectId, phase } = req.params;
    const { content, version } = req.body;
    const userId = req.user.id;

    // Check if user has access to project
    const project = await prisma.specificationProject.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { team: { some: { userId, status: 'ACTIVE' } } },
        ],
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const updatedDocument = await workflowService.updateDocument(
      projectId,
      phase as any,
      { content, version },
      userId
    );

    res.json({
      success: true,
      message: 'Document updated successfully',
      document: updatedDocument,
    });
  } catch (error) {
    console.error('Document update error:', error);
    
    if (error.name === 'SpecificationWorkflowError') {
      return res.status(error.statusCode || 400).json({
        error: error.message,
        code: error.code,
        phase: error.phase,
      });
    }
    
    res.status(500).json({ error: 'Failed to update document' });
  }
});

// Get phase validation rules
router.get('/workflow/validation-rules', authenticateToken, async (req, res) => {
  try {
    const validationRules = {
      REQUIREMENTS: {
        requiredSections: ['Introduction', 'Requirements'],
        minimumWordCount: 200,
        requiredApprovals: 1,
        customValidations: [
          'User stories format (As a [role], I want [feature], so that [benefit])',
          'EARS format for acceptance criteria (WHEN/IF/THEN/SHALL)',
          'Numbered requirements for traceability',
        ],
      },
      DESIGN: {
        requiredSections: ['Overview', 'Architecture', 'Components'],
        minimumWordCount: 500,
        requiredApprovals: 1,
        customValidations: [
          'Architecture diagrams or detailed descriptions',
          'Data model specifications',
          'API design documentation',
        ],
      },
      TASKS: {
        requiredSections: ['Implementation Plan'],
        minimumWordCount: 300,
        requiredApprovals: 1,
        customValidations: [
          'Task checkboxes format (- [ ] Task description)',
          'Requirement references (_Requirements: 1.1, 1.2_)',
          'Hierarchical task organization',
        ],
      },
      IMPLEMENTATION: {
        requiredSections: ['Implementation Notes'],
        minimumWordCount: 100,
        requiredApprovals: 0,
        customValidations: [],
      },
    };

    res.json(validationRules);
  } catch (error) {
    console.error('Get validation rules error:', error);
    res.status(500).json({ error: 'Failed to get validation rules' });
  }
});

// Check if user can transition to specific phase
router.get('/projects/:projectId/workflow/can-transition/:targetPhase', authenticateToken, async (req, res) => {
  try {
    const { projectId, targetPhase } = req.params;
    const userId = req.user.id;

    // Check if user has access to project
    const project = await prisma.specificationProject.findFirst({
      where: {
        id: projectId,
        OR: [
          { ownerId: userId },
          { team: { some: { userId, status: 'ACTIVE' } } },
        ],
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found or access denied' });
    }

    const canTransition = await workflowService.canTransitionToPhase(
      projectId,
      targetPhase as any,
      userId
    );

    res.json(canTransition);
  } catch (error) {
    console.error('Can transition check error:', error);
    res.status(500).json({ error: 'Failed to check transition permission' });
  }
});

export default router;