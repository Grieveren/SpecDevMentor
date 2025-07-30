# CodeMentor AI - Production Deployment Checklist

This checklist ensures your local production environment is properly configured for UAT testing.

## Pre-Deployment Checklist

### ✅ Environment Setup

- [ ] Node.js 18+ installed
- [ ] pnpm 8+ installed
- [ ] Docker and Docker Compose installed
- [ ] Git repository cloned
- [ ] All dependencies installed (`pnpm install`)

### ✅ Configuration Files

- [ ] `.env` file created from `.env.example`
- [ ] `server/.env` file created from `server/.env.example`
- [ ] Database credentials updated
- [ ] JWT secrets generated (min 32 characters)
- [ ] OpenAI API key configured
- [ ] SMTP settings configured (if using email)

### ✅ Security Configuration

- [ ] Strong JWT secrets (not default values)
- [ ] Encryption salt configured (exactly 32 characters)
- [ ] Session secret configured
- [ ] CORS origins properly set
- [ ] Rate limiting configured
- [ ] File upload restrictions set

### ✅ Database Setup

- [ ] PostgreSQL container running
- [ ] Database migrations applied
- [ ] Sample data seeded
- [ ] Database health check passes

### ✅ Redis Setup

- [ ] Redis container running
- [ ] Redis connection verified
- [ ] Cache configuration set

## Deployment Steps

### 1. Quick Start (Recommended)

```bash
# One-command setup
pnpm start
```

### 2. Manual Setup (Advanced)

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env
cp server/.env.example server/.env
# Edit .env files with your configuration

# Start infrastructure
docker-compose up -d postgres redis

# Setup database
cd server
pnpm prisma generate
pnpm prisma db push
pnpm prisma db seed
cd ..

# Build applications
pnpm build

# Start applications
cd server && pnpm start &
cd client && pnpm preview --port 3000 &
```

## Post-Deployment Verification

### ✅ Service Health Checks

- [ ] Frontend accessible: http://localhost:3000
- [ ] Backend API healthy: http://localhost:3001/health
- [ ] Database connection: `docker exec codementor-postgres pg_isready -U codementor -d codementor_ai`
- [ ] Redis connection: `docker exec codementor-redis redis-cli ping`

### ✅ Application Features

- [ ] User registration works
- [ ] User login works
- [ ] Project creation works
- [ ] Specification workflow functions
- [ ] AI review system operational
- [ ] Real-time collaboration active
- [ ] File upload functional
- [ ] Search functionality working

### ✅ Performance Verification

- [ ] Page load times < 3 seconds
- [ ] API response times < 2 seconds
- [ ] Database queries optimized
- [ ] Memory usage within limits
- [ ] No memory leaks detected

### ✅ Security Verification

- [ ] Authentication required for protected routes
- [ ] Input validation working
- [ ] File upload security active
- [ ] Rate limiting functional
- [ ] HTTPS ready (for production)

## UAT Testing Preparation

### ✅ Test Data Setup

- [ ] Admin user created
- [ ] Sample projects created
- [ ] Team members added
- [ ] Test specifications prepared
- [ ] Learning modules available

### ✅ Test Environment

- [ ] All browsers tested (Chrome, Firefox, Safari, Edge)
- [ ] Mobile responsiveness verified
- [ ] Accessibility features working
- [ ] Performance benchmarks established

### ✅ Monitoring Setup

- [ ] Application logs configured
- [ ] Error tracking active
- [ ] Performance monitoring enabled
- [ ] Health checks automated

## Common Issues & Solutions

### Issue: Port Already in Use

```bash
# Check what's using the port
lsof -i :3000
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### Issue: Database Connection Failed

```bash
# Check PostgreSQL status
docker exec codementor-postgres pg_isready -U codementor -d codementor_ai

# Restart database
docker-compose restart postgres
```

### Issue: Redis Connection Failed

```bash
# Check Redis status
docker exec codementor-redis redis-cli ping

# Restart Redis
docker-compose restart redis
```

### Issue: Build Failures

```bash
# Clean and rebuild
pnpm clean
pnpm install
pnpm build
```

### Issue: Permission Errors

```bash
# Fix script permissions
chmod +x scripts/*.sh
```

## Environment Reset

If you need to completely reset your environment:

```bash
# Complete reset
pnpm reset

# Or manual reset
./scripts/reset-local-environment.sh
```

## Production Deployment (Real Production)

For actual production deployment:

1. **Update Environment Variables**

   - Use production database URLs
   - Set strong, unique secrets
   - Configure production SMTP
   - Set appropriate CORS origins

2. **Security Hardening**

   - Enable HTTPS
   - Configure proper firewall rules
   - Set up SSL certificates
   - Enable security headers

3. **Infrastructure Setup**

   - Use managed database services
   - Set up load balancers
   - Configure CDN
   - Set up monitoring and alerting

4. **Deployment Process**
   - Use CI/CD pipelines
   - Implement blue-green deployment
   - Set up automated backups
   - Configure log aggregation

## Support & Documentation

- **Setup Guide**: `LOCAL_PRODUCTION_SETUP.md`
- **UAT Testing**: `UAT_TESTING_GUIDE.md`
- **Deployment**: `docs/deployment.md`
- **API Documentation**: http://localhost:3001/api-docs (when running)

## Quick Commands Reference

```bash
# Start production environment
pnpm start

# Stop all services
pnpm stop

# Reset environment
pnpm reset

# Check health
pnpm health

# View logs
pnpm logs

# Run tests
pnpm test:e2e

# Database backup
pnpm db:backup
```

## Final Verification

Before starting UAT testing, verify:

- [ ] All services running without errors
- [ ] All health checks passing
- [ ] Test data properly seeded
- [ ] All features accessible
- [ ] Performance within acceptable limits
- [ ] Security measures active
- [ ] Monitoring and logging operational

## UAT Testing

Once everything is verified, proceed with UAT testing using the scenarios in `UAT_TESTING_GUIDE.md`.

Remember to document any issues found during testing and create tickets for resolution.

---

**Need Help?**

- Check logs in `logs/` directory
- Review error messages in browser console
- Verify environment configuration
- Ensure all prerequisites are installed
- Contact development team if issues persist
