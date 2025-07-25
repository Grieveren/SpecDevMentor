import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createAuthRoutes } from './routes/auth.routes.js';
import projectRoutes from './routes/project.routes.js';
import workflowRoutes from './routes/specification-workflow.routes.js';
import aiReviewRoutes from './routes/ai-review.routes.js';
import RedisClient from './utils/redis.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

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
app.get('/health', async (_req, res) => {
  const redisConnected = RedisClient.isRedisConnected();
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      redis: redisConnected ? 'connected' : 'disconnected',
    },
  });
});

// API routes
app.get('/api', (_req, res) => {
  res.json({ message: 'CodeMentor AI API Server' });
});

// Initialize Redis and setup routes
async function setupRoutes() {
  try {
    const redis = await RedisClient.getInstance();
    
    // Authentication routes
    app.use('/api/auth', createAuthRoutes(redis));
    
    // Project routes
    app.use('/api/projects', projectRoutes);
    
    // Specification workflow routes
    app.use('/api', workflowRoutes);
    
    // AI review routes
    app.use('/api/ai-review', aiReviewRoutes);
    
    console.log('✅ Routes initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize routes:', error);
    process.exit(1);
  }
}

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
  });
});

// 404 handler
app.use('*', (_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
  try {
    await setupRoutes();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
