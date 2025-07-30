# CodeMentor AI - Local Production Setup Guide

This guide will help you set up a complete production-like environment locally for end-to-end UAT testing.

## Prerequisites

- Node.js 18+ and pnpm 8+
- Docker and Docker Compose
- Git

## Quick Start

1. **Clone and Install Dependencies**

```bash
git clone <your-repo>
cd codementor-ai-platform
pnpm install
```

2. **Set up Environment Variables**

```bash
cp .env.example .env
cp server/.env.example server/.env
```

3. **Start Production Environment**

```bash
./scripts/start-production-local.sh
```

4. **Access the Application**

- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- Database: localhost:5432

## Detailed Setup Instructions

### 1. Environment Configuration

#### Root `.env` file:

```env
NODE_ENV=production
DATABASE_URL="postgresql://codementor:password@localhost:5432/codementor_ai"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
OPENAI_API_KEY="your-openai-api-key"
ENCRYPTION_SALT="your-encryption-salt-32-chars-long"
CLIENT_URL="http://localhost:3000"
SERVER_URL="http://localhost:3001"
```

#### Server `.env` file:

```env
NODE_ENV=production
PORT=3001
DATABASE_URL="postgresql://codementor:password@localhost:5432/codementor_ai"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-in-production"
REFRESH_SECRET="your-super-secret-refresh-key-change-in-production"
OPENAI_API_KEY="your-openai-api-key"
ENCRYPTION_SALT="your-encryption-salt-32-chars-long"
CLIENT_URL="http://localhost:3000"
CORS_ORIGIN="http://localhost:3000"
```

### 2. Database Setup

The production setup includes:

- PostgreSQL 15 with optimized configuration
- Redis 7 for caching and sessions
- Automated database migrations
- Sample data seeding

### 3. Services Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Client  │    │  Node.js API    │    │   PostgreSQL    │
│   (Port 3000)   │◄──►│   (Port 3001)   │◄──►│   (Port 5432)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │      Redis      │
                       │   (Port 6379)   │
                       └─────────────────┘
```

### 4. Production Features Enabled

- **Security**: HTTPS ready, CORS configured, rate limiting
- **Performance**: Redis caching, connection pooling, compression
- **Monitoring**: Health checks, error tracking, performance metrics
- **Logging**: Structured logging with Winston
- **File Storage**: Local file system with proper permissions

## UAT Testing Scenarios

### 1. User Authentication Flow

- User registration with email verification
- Login with JWT token management
- Password reset functionality
- Role-based access control

### 2. Specification Workflow

- Create new specification project
- Progress through Requirements → Design → Tasks → Implementation
- AI-powered review and suggestions
- Phase transition validation

### 3. Collaboration Features

- Real-time collaborative editing
- Comment threads and discussions
- User presence indicators
- Conflict resolution

### 4. AI Integration

- Specification quality analysis
- EARS format validation
- Automated suggestions and improvements
- Code compliance checking

### 5. Code Execution

- Secure code execution in Docker sandbox
- Multiple language support (JavaScript, Python, etc.)
- Resource limits and timeout handling
- Security isolation testing

### 6. Learning System

- Interactive lessons and exercises
- Progress tracking and skill assessment
- Personalized learning paths
- Achievement system

### 7. Analytics and Reporting

- Team performance dashboards
- Individual progress tracking
- Project success metrics
- Export capabilities

## Monitoring and Debugging

### Health Checks

- API Health: http://localhost:3001/health
- Database Status: http://localhost:3001/health/db
- Redis Status: http://localhost:3001/health/redis

### Logs Location

- Application logs: `./logs/app.log`
- Error logs: `./logs/error.log`
- Access logs: `./logs/access.log`

### Database Access

```bash
# Connect to PostgreSQL
docker exec -it codementor-postgres psql -U codementor -d codementor_ai

# Connect to Redis
docker exec -it codementor-redis redis-cli
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**

   - Check if ports 3000, 3001, 5432, 6379 are available
   - Use `lsof -i :PORT` to check port usage

2. **Database Connection Issues**

   - Ensure PostgreSQL container is running
   - Check DATABASE_URL in environment files
   - Verify database credentials

3. **Redis Connection Issues**

   - Ensure Redis container is running
   - Check REDIS_URL in environment files

4. **OpenAI API Issues**
   - Verify OPENAI_API_KEY is set correctly
   - Check API quota and rate limits

### Reset Environment

```bash
./scripts/reset-local-environment.sh
```

## Performance Testing

The setup includes performance testing tools:

- Load testing with Artillery
- Database performance monitoring
- Memory and CPU usage tracking
- Response time analysis

## Security Testing

Security features enabled:

- Input validation and sanitization
- SQL injection prevention
- XSS protection
- CSRF protection
- Rate limiting
- Secure headers

## Backup and Recovery

Automated backup scripts:

- Database backups every hour
- File storage backups
- Configuration backups
- Recovery procedures documented

## Next Steps

After setup completion:

1. Run the test suite: `pnpm test`
2. Execute E2E tests: `pnpm test:e2e`
3. Start UAT testing scenarios
4. Monitor application performance
5. Review security configurations

For production deployment, see `docs/deployment.md`.
