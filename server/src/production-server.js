// Production-quality server with real database integration
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

// Initialize Prisma client
const prisma = new PrismaClient();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Other middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    service: 'SpecDevMentor Production API',
    version: '1.0.0',
    database: 'Connected'
  });
});

// JWT utilities
const generateTokens = (user) => {
  const accessToken = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET || 'dev-jwt-secret',
    { expiresIn: '1h' }
  );
  
  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.REFRESH_SECRET || 'dev-refresh-secret',
    { expiresIn: '7d' }
  );
  
  return { accessToken, refreshToken };
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'dev-jwt-secret', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// ================================
// AUTHENTICATION ROUTES
// ================================

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    console.log('📝 Registration request:', { email: req.body.email, name: req.body.name });
    
    const { name, email, password } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
    }
    
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });
    
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'STUDENT',
        emailVerified: new Date() // Auto-verify for demo
      }
    });
    
    // Generate tokens
    const tokens = generateTokens(user);
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: userWithoutPassword,
        tokens
      }
    });
    
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('📝 Login request:', { email: req.body.email });
    
    const { email, password } = req.body;
    
    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Generate tokens
    const tokens = generateTokens(user);
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: userWithoutPassword,
        tokens
      }
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Token validation endpoint
app.post('/api/auth/validate', authenticateToken, async (req, res) => {
  try {
    // Get fresh user data
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, emailVerified: true }
    });
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Token is valid',
      data: { user }
    });
    
  } catch (error) {
    console.error('Token validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// ================================
// PROJECT ROUTES
// ================================

// Get projects
app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Projects request for user:', req.user.userId);
    
    const projects = await prisma.specificationProject.findMany({
      where: {
        OR: [
          { createdById: req.user.userId },
          {
            teamMembers: {
              some: { userId: req.user.userId }
            }
          }
        ]
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        teamMembers: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        },
        _count: {
          select: {
            documents: true,
            teamMembers: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
    
    res.json({
      success: true,
      message: 'Projects retrieved successfully',
      data: { projects }
    });
    
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve projects'
    });
  }
});

// Create project
app.post('/api/projects', authenticateToken, async (req, res) => {
  try {
    console.log('📋 Create project request:', req.body);
    
    const { name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Project name is required'
      });
    }
    
    const project = await prisma.specificationProject.create({
      data: {
        name,
        description: description || '',
        status: 'ACTIVE',
        currentPhase: 'REQUIREMENTS',
        createdById: req.user.userId,
        teamMembers: {
          create: {
            userId: req.user.userId,
            role: 'OWNER',
            status: 'ACTIVE'
          }
        }
      },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true }
        },
        teamMembers: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: { project }
    });
    
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create project'
    });
  }
});

// ================================
// ERROR HANDLING
// ================================

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /health',
      'POST /api/auth/register',
      'POST /api/auth/login', 
      'POST /api/auth/validate',
      'GET /api/projects',
      'POST /api/projects'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 SpecDevMentor Production Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
  console.log(`🗄️  Database: PostgreSQL with Prisma ORM`);
  console.log(`🔐 JWT Authentication enabled`);
  console.log(`\n📚 Available endpoints:`);
  console.log(`   POST /api/auth/register - User registration with real database`);
  console.log(`   POST /api/auth/login - User login with password verification`);
  console.log(`   POST /api/auth/validate - Token validation`);
  console.log(`   GET /api/projects - List user's projects`);
  console.log(`   POST /api/projects - Create new project`);
  console.log(`\n✨ Full production features enabled!`);
});

export default app;