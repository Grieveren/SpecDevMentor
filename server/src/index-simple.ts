import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import { createServer } from 'http';
import morgan from 'morgan';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

// Initialize Prisma client
const prisma = new PrismaClient();

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        server: 'running',
      },
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

// Basic API routes
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await prisma.specificationProject.findMany({
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            documents: true,
            team: true,
          },
        },
      },
      take: 10,
    });

    res.json({
      success: true,
      data: {
        projects,
        pagination: {
          page: 1,
          limit: 10,
          total: projects.length,
          pages: 1,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch projects',
    });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
      take: 10,
    });

    res.json({
      success: true,
      data: { users },
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch users',
    });
  }
});

// Additional production endpoints
app.get('/api/templates', async (req, res) => {
  try {
    // Mock template data for production demo
    const templates = [
      {
        id: '1',
        name: 'E-commerce Requirements Template',
        description: 'Comprehensive template for e-commerce platform requirements',
        category: 'Requirements',
        tags: ['e-commerce', 'requirements', 'business'],
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'API Design Specification',
        description: 'REST API design and documentation template',
        category: 'Design',
        tags: ['api', 'rest', 'design'],
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        name: 'Testing Strategy Template',
        description: 'Comprehensive testing strategy and test case templates',
        category: 'Testing',
        tags: ['testing', 'quality', 'strategy'],
        createdAt: new Date().toISOString(),
      },
    ];

    res.json({
      success: true,
      data: { templates },
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch templates',
    });
  }
});

app.get('/api/learning/modules', async (req, res) => {
  try {
    // Mock learning modules for production demo
    const modules = [
      {
        id: '1',
        title: 'Requirements Gathering',
        description: 'Learn how to effectively gather and document requirements',
        duration: '2 hours',
        level: 'Beginner',
        lessons: 8,
        completed: false,
      },
      {
        id: '2',
        title: 'Specification Writing',
        description: 'Master the art of writing clear, comprehensive specifications',
        duration: '3 hours',
        level: 'Intermediate',
        lessons: 12,
        completed: false,
      },
      {
        id: '3',
        title: 'AI-Powered Review',
        description: 'Using AI tools to enhance specification quality',
        duration: '1.5 hours',
        level: 'Advanced',
        lessons: 6,
        completed: false,
      },
    ];

    res.json({
      success: true,
      data: { modules },
    });
  } catch (error) {
    console.error('Error fetching learning modules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch learning modules',
    });
  }
});

// Specification workflow endpoints
app.get('/api/specification-workflow/projects/:projectId/documents', async (req, res) => {
  try {
    const { projectId } = req.params;

    // Get project details
    const project = await prisma.specificationProject.findUnique({
      where: { id: projectId },
      include: {
        owner: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Project not found',
      });
    }

    // Mock documents for the project
    const documents = [
      {
        id: '1',
        projectId,
        title: 'Requirements Specification',
        content:
          '## Requirements\n\n1. User authentication\n2. Product catalog\n3. Shopping cart\n4. Payment processing',
        phase: 'REQUIREMENTS',
        status: 'COMPLETED',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: '2',
        projectId,
        title: 'System Design',
        content:
          '## Architecture\n\n- Frontend: React\n- Backend: Node.js\n- Database: PostgreSQL\n- Cache: Redis',
        phase: 'DESIGN',
        status: 'IN_PROGRESS',
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    res.json({
      success: true,
      data: { documents, project },
    });
  } catch (error) {
    console.error('Error fetching project documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch project documents',
    });
  }
});

// AI Review endpoint
app.post('/api/ai-review/request', async (req, res) => {
  try {
    const { documentId, content, phase } = req.body;

    if (!documentId || !content || !phase) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: documentId, content, phase',
      });
    }

    // Mock AI review response
    const review = {
      id: 'review_' + Date.now(),
      documentId,
      phase,
      score: 85,
      feedback: [
        {
          type: 'suggestion',
          message: 'Consider adding more detailed acceptance criteria for user stories',
          lineNumber: 5,
          severity: 'medium',
        },
        {
          type: 'improvement',
          message: 'Add non-functional requirements section',
          lineNumber: null,
          severity: 'low',
        },
      ],
      suggestions: [
        'Add performance requirements',
        'Include security considerations',
        'Define success metrics',
      ],
      createdAt: new Date().toISOString(),
    };

    res.json({
      success: true,
      data: { review },
    });
  } catch (error) {
    console.error('Error processing AI review:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process AI review',
    });
  }
});

// Analytics endpoint
app.get('/api/analytics/overview', async (req, res) => {
  try {
    const analytics = {
      totalProjects: 2,
      activeProjects: 2,
      completedProjects: 0,
      totalUsers: 3,
      activeUsers: 3,
      totalDocuments: 6,
      aiReviews: 0,
      averageProjectCompletion: 75,
      recentActivity: [
        {
          id: '1',
          type: 'project_created',
          message: 'New project "Personal Blog Platform" created',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: '2',
          type: 'user_registered',
          message: 'New user registered',
          timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
      ],
    };

    res.json({
      success: true,
      data: analytics,
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
    });
  }
});

// Validation helper functions
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function validatePassword(password: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!password || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (!/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (!/[@$!%*?&]/.test(password)) {
    errors.push('Password must contain at least one special character (@$!%*?&)');
  }

  return { isValid: errors.length === 0, errors };
}

// Basic auth endpoints
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Validation errors array
    const errors: string[] = [];

    // Check required fields
    if (!name || name.trim().length === 0) {
      errors.push('Name is required');
    } else if (name.trim().length < 2) {
      errors.push('Name must be at least 2 characters long');
    } else if (name.trim().length > 50) {
      errors.push('Name cannot exceed 50 characters');
    }

    if (!email || email.trim().length === 0) {
      errors.push('Email is required');
    } else if (!validateEmail(email)) {
      errors.push('Please provide a valid email address');
    }

    if (!password) {
      errors.push('Password is required');
    } else {
      const passwordValidation = validatePassword(password);
      if (!passwordValidation.isValid) {
        errors.push(...passwordValidation.errors);
      }
    }

    // If validation errors exist, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors,
      });
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists with this email',
        errors: ['Email is already registered'],
      });
    }

    // Hash password (production implementation)
    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        password: hashedPassword,
        role: 'DEVELOPER',
      },
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
        tokens: {
          accessToken: 'demo-access-token',
          refreshToken: 'demo-refresh-token',
        },
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      errors: ['Internal server error'],
    });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password: _password } = req.body;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        password: true,
        isVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // For demo purposes, we'll skip password hashing verification
    // In production, you'd use bcrypt.compare(password, user.password)

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isVerified: user.isVerified,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        },
        tokens: {
          accessToken: 'demo-access-token',
          refreshToken: 'demo-refresh-token',
        },
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
});

// Error handling middleware
app.use(
  (error: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Unhandled error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    server.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  await prisma.$disconnect();
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

startServer();
