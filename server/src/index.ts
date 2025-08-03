// @ts-nocheck
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { PrismaClient } from '@prisma/client';
import { createAuthRoutes } from './routes/auth.routes.js';
import projectRoutes from './routes/project.routes.js';
import workflowRoutes from './routes/specification-workflow.routes.js';
import aiReviewRoutes from './routes/ai-review.routes.js';
import codeExecutionRoutes from './routes/code-execution.routes.js';
import templateRoutes from './routes/template.routes.js';
import bestPracticesRoutes from './routes/best-practices.routes.js';
import learningRoutes from './routes/learning.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import performanceRoutes, { requestMetricsMiddleware } from './routes/performance.routes.js';
import notificationRoutes, { initializeNotificationRoutes } from './routes/notification.routes.js';
import fileUploadRoutes from './routes/file-upload.routes.js';
import searchRoutes from './routes/search.routes.js';
import monitoringRoutes from './routes/monitoring.routes.js';
import RedisClient from './utils/redis.js';
import { CollaborationService } from './services/collaboration.service.js';
import { EmailProcessorService } from './services/email-processor.service.js';
import { requestLoggingMiddleware, errorLoggingMiddleware } from './services/logger.service.js';
import { errorTrackingMiddleware } from './services/error-tracking.service.js';

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

// Performance monitoring middleware
app.use(requestMetricsMiddleware);

// Logging middleware
app.use(requestLoggingMiddleware);

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

// Initialize Redis, collaboration service, and setup routes
async function setupServices() {
  try {
    const redis = await RedisClient.getInstance();
    
    // Initialize collaboration service
    const collaborationService = new CollaborationService(server, redis, prisma);
    
    // Initialize email processor service
    const emailProcessor = new EmailProcessorService(prisma, redis);
    emailProcessor.start(); // Start processing emails every 30 seconds
    
    // Authentication routes
    app.use('/api/auth', createAuthRoutes(redis));
    
    // Project routes
    app.use('/api/projects', projectRoutes);
    
    // Specification workflow routes
    app.use('/api', workflowRoutes);
    
    // AI review routes
    app.use('/api/ai-review', aiReviewRoutes);
    
    // Code execution routes
    app.use('/api/code-execution', codeExecutionRoutes);
    
    // Template routes
    app.use('/api/templates', templateRoutes);
    
    // Best practices routes
    app.use('/api/best-practices', bestPracticesRoutes);
    
    // Learning routes
    app.use('/api/learning', learningRoutes);
    
    // Analytics routes
    app.use('/api/analytics', analyticsRoutes);
    
    // Performance monitoring routes
    app.use('/api/performance', performanceRoutes);
    
    // Notification routes (initialize with Socket.IO server)
    app.use('/api/notifications', initializeNotificationRoutes(collaborationService.io));
    
    // File upload routes
    app.use('/api/files', fileUploadRoutes);
    
    // Search routes
    app.use('/api/search', searchRoutes);
    
    // Monitoring routes
    app.use('/monitoring', monitoringRoutes);
    
    // Collaboration stats endpoint
    app.get('/api/collaboration/stats', (_req, res) => {
      const stats = collaborationService.getCollaborationStats();
      res.json(stats);
    });
    
    // // console.log('✅ Services and routes initialized successfully');
    return { redis, collaborationService, emailProcessor };
  } catch (error) {
    console.error('❌ Failed to initialize services:', error);
    process.exit(1);
  }
}

// Error handling middleware
app.use(errorLoggingMiddleware);
app.use(errorTrackingMiddleware);
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
    const { redis, collaborationService, emailProcessor } = await setupServices();
    
    server.listen(PORT, () => {
      // // console.log(`🚀 Server running on port ${PORT}`);
      // // console.log(`📊 Health check: http://localhost:${PORT}/health`);
      // // console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      // // console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
      // // console.log(`🤝 WebSocket collaboration enabled`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      // // console.log('🛑 SIGTERM received, shutting down gracefully');
      emailProcessor.stop();
      server.close(() => {
        redis.disconnect();
        prisma.$disconnect();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      // // console.log('🛑 SIGINT received, shutting down gracefully');
      emailProcessor.stop();
      server.close(() => {
        redis.disconnect();
        prisma.$disconnect();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
