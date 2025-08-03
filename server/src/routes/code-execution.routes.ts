// @ts-nocheck
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import { CodeExecutionService } from '../services/code-execution.service.js';
import { SpecificationComplianceService } from '../services/specification-compliance.service.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { SupportedLanguage } from '../types/code-execution.js';

const router = Router();
const codeExecutionService = new CodeExecutionService();
const complianceService = new SpecificationComplianceService();

// Validation middleware
const validateExecutionRequest = [
  body('code')
    .notEmpty()
    .withMessage('Code is required')
    .isLength({ max: 50000 })
    .withMessage('Code exceeds maximum length (50KB)'),
  body('language')
    .isIn(Object.values(SupportedLanguage))
    .withMessage('Invalid or unsupported language'),
  body('input')
    .optional()
    .isLength({ max: 10000 })
    .withMessage('Input exceeds maximum length (10KB)'),
  body('timeout')
    .optional()
    .isInt({ min: 1000, max: 120000 })
    .withMessage('Timeout must be between 1-120 seconds'),
];

// Execute code endpoint
router.post('/execute', authMiddleware, validateExecutionRequest, async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { code, language, input, timeout } = req.body;

    // Execute code
    const _result = await codeExecutionService.executeCode({
      code,
      language,
      input,
      timeout,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Code execution error:', error);

    if (error.name === 'SecurityError') {
      return res.status(400).json({
        success: false,
        message: 'Security violation',
        error: error.message,
      });
    }

    if (error.name === 'ExecutionTimeoutError') {
      return res.status(408).json({
        success: false,
        message: 'Execution timeout',
        error: error.message,
      });
    }

    if (error.name === 'ResourceLimitError') {
      return res.status(429).json({
        success: false,
        message: 'Resource limit exceeded',
        error: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Execution failed',
    });
  }
});

// Get supported languages
router.get('/languages', authMiddleware, async (req, res) => {
  try {
    const languages = codeExecutionService.getSupportedLanguages();
    
    res.json({
      success: true,
      data: {
        languages,
        count: languages.length,
      },
    });
  } catch (error) {
    console.error('Error fetching supported languages:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supported languages',
    });
  }
});

// Get system status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const activeSandboxes = codeExecutionService.getActiveSandboxCount();
    
    res.json({
      success: true,
      data: {
        status: 'healthy',
        activeSandboxes,
        supportedLanguages: codeExecutionService.getSupportedLanguages().length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching system status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system status',
    });
  }
});

// Validate code compliance against specifications
router.post('/validate-compliance', authMiddleware, [
  body('code')
    .notEmpty()
    .withMessage('Code is required')
    .isLength({ max: 50000 })
    .withMessage('Code exceeds maximum length (50KB)'),
  body('language')
    .isIn(Object.values(SupportedLanguage))
    .withMessage('Invalid or unsupported language'),
  body('specifications')
    .isArray({ min: 1 })
    .withMessage('At least one specification document is required'),
  body('specifications.*.id')
    .notEmpty()
    .withMessage('Specification ID is required'),
  body('specifications.*.content')
    .notEmpty()
    .withMessage('Specification content is required'),
  body('specifications.*.phase')
    .isIn(['requirements', 'design', 'tasks'])
    .withMessage('Invalid specification phase'),
], async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { code, language, specifications } = req.body;

    // Validate compliance
    const _result = await complianceService.validateCodeCompliance(
      code,
      language,
      specifications
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Compliance validation error:', error);

    res.status(500).json({
      success: false,
      message: 'Compliance validation failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Validation failed',
    });
  }
});

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    // Basic health check - could be expanded to check Docker daemon
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      error: error.message,
    });
  }
});

export default router;