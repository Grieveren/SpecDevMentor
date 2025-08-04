// Simple Express server for testing basic functionality
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

import type { Application } from 'express';const app: Application = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

// Add request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', req.body);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Basic health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'SpecDevMentor API',
    version: '1.0.0'
  });
});

// Mock authentication endpoints (with and without /api prefix)
app.post('/api/auth/register', (req: Request, res: Response) => {
  try {
    console.log('📝 Registration request received at /api/auth/register:', {
      body: req.body,
      headers: req.headers['content-type']
    });
    
    const { name, email, password } = req.body;
    
    // Basic validation
    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'Name, email, and password are required'
      });
    }
    
    // Simulate registration with proper ApiResponse format for frontend
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: 'user_123',
          name: name,
          email: email,
          role: 'STUDENT'
        },
        tokens: {
          accessToken: 'mock_access_token_12345',
          refreshToken: 'mock_refresh_token_12345'
        }
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Also handle routes without /api prefix
app.post('/auth/register', (req: Request, res: Response) => {
  console.log('📝 Registration request received at /auth/register:', {
    body: req.body,
    headers: req.headers['content-type']
  });
  
  const { name, email, password } = req.body;
  
  // Simulate registration with proper response format
  res.status(201).json({
    user: {
      id: 'user_123',
      name: name,
      email: email,
      role: 'STUDENT'
    },
    tokens: {
      accessToken: 'mock_access_token_12345',
      refreshToken: 'mock_refresh_token_12345'
    }
  });
});

app.post('/auth/login', (req: Request, res: Response) => {
  console.log('📝 Login request received at /auth/login:', req.body);
  
  const { email, password } = req.body;
  
  // Simulate login with proper response format
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: 'user_123',
        name: 'Demo User',
        email: email,
        role: 'STUDENT'
      },
      tokens: {
        accessToken: 'mock_access_token_12345',
        refreshToken: 'mock_refresh_token_12345'
      }
    }
  });
});

// Add /api/auth/login route
app.post('/api/auth/login', (req: Request, res: Response) => {
  console.log('📝 Login request received at /api/auth/login:', req.body);
  
  const { email, password } = req.body;
  
  // Simulate login with proper response format
  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: 'user_123',
        name: 'Demo User', 
        email: email,
        role: 'STUDENT'
      },
      tokens: {
        accessToken: 'mock_access_token_12345',
        refreshToken: 'mock_refresh_token_12345'
      }
    }
  });
});

// Add token validation route
app.post('/api/auth/validate', (req: Request, res: Response) => {
  console.log('📝 Token validation request received');
  
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }
  
  // Mock token validation - always succeed for demo
  res.json({
    success: true,
    message: 'Token is valid',
    data: {
      user: {
        id: 'user_123',
        name: 'Demo User',
        email: 'john@test.com',
        role: 'STUDENT'
      }
    }
  });
});

// Mock projects endpoint
app.get('/api/projects', (req: Request, res: Response) => {
  console.log('📋 Projects request received');
  
  res.json({
    success: true,
    message: 'Projects retrieved successfully',
    data: {
      projects: [
        {
          id: 'proj_1',
          name: 'Sample E-commerce Platform',
          description: 'A complete e-commerce solution with user management',
          phase: 'REQUIREMENTS',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'proj_2', 
          name: 'Task Management App',
          description: 'Collaborative task management with real-time updates',
          phase: 'DESIGN',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'proj_3',
          name: 'Learning Management System',
          description: 'Educational platform with course management and progress tracking',
          phase: 'TASKS',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    }
  });
});

app.post('/api/projects', (req: Request, res: Response) => {
  console.log('📋 Create project request received:', req.body);
  
  const { name, description } = req.body;
  
  res.status(201).json({
    success: true,
    message: 'Project created successfully',
    data: {
      project: {
        id: 'proj_' + Date.now(),
        name,
        description,
        phase: 'REQUIREMENTS',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    }
  });
});

// Catch all for unhandled routes
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /health',
      'POST /api/auth/register', 
      'POST /api/auth/login',
      'GET /api/projects',
      'POST /api/projects'
    ]
  });
});

// Error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Server Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ SpecDevMentor API Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 CORS enabled for: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
  console.log(`📚 Available routes:`);
  console.log(`   POST /api/auth/register - User registration`);
  console.log(`   POST /api/auth/login - User login`);
  console.log(`   GET /api/projects - List projects`);
  console.log(`   POST /api/projects - Create project`);
});

export default app;
