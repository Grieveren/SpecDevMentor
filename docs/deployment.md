# CodeMentor AI - Production Deployment Guide

## Overview

This guide covers the complete production deployment setup for the CodeMentor AI platform using Kubernetes, including database migration strategies, backup procedures, and monitoring setup.

## Prerequisites

### Required Tools

- **kubectl** (v1.25+) - Kubernetes command-line tool
- **docker** (v20.10+) - Container runtime
- **pnpm** (v8.0+) - Package manager
- **helm** (v3.10+) - Kubernetes package manager (optional)

### Infrastructure Requirements

- **Kubernetes cluster** (v1.25+) with at least 3 nodes
- **Storage class** for persistent volumes
- **Ingress controller** (nginx recommended)
- **Certificate manager** for SSL/TLS
- **Container registry** (GitHub Container Registry or Docker Hub)

### Environment Setup

- Domain name configured (e.g., codementor-ai.com)
- SSL certificates (Let's Encrypt recommended)
- SMTP server for email notifications and monitoring alerts
- OpenAI API key
- Performance monitoring configuration (Redis for metrics, SMTP for alerts)

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐
│   Load Balancer │    │   Ingress       │
│   (nginx)       │────│   Controller    │
└─────────────────┘    └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Client Pods   │
                       │   (React/nginx) │
                       └─────────────────┘
                                │
                       ┌─────────────────┐
                       │   Server Pods   │
                       │   (Node.js)     │
                       └─────────────────┘
                                │
                    ┌───────────┴───────────┐
           ┌─────────────────┐    ┌─────────────────┐
           │   PostgreSQL    │    │     Redis       │
           │   (Primary)     │    │    (Cache)      │
           └─────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Clone and Configure

```bash
git clone https://github.com/your-org/codementor-ai-platform.git
cd codementor-ai-platform

# Copy and configure secrets
cp k8s/secrets.yaml k8s/secrets-prod.yaml
# Edit k8s/secrets-prod.yaml with actual values
```

### 2. Configure Secrets

Edit `k8s/secrets-prod.yaml` and replace all `REPLACE_WITH_*` placeholders:

```yaml
# Required secrets to configure:
- POSTGRES_PASSWORD: Strong database password
- JWT_SECRET: 64+ character random string
- REFRESH_SECRET: 64+ character random string
- OPENAI_API_KEY: Your OpenAI API key
- SMTP_USER: Email server username (for notifications and monitoring alerts)
- SMTP_PASSWORD: Email server password
- ENCRYPTION_SALT: 32 character random string
- SESSION_SECRET: Session secret key
- METRIC_RETENTION_HOURS: Metric retention period (default: 24)
- ALERT_COOLDOWN_PERIOD: Alert cooldown in seconds (default: 1800)
```

### 3. Deploy

```bash
# Make deployment script executable
chmod +x scripts/deploy.sh

# Deploy to production
./scripts/deploy.sh deploy
```

## Detailed Deployment Steps

### Step 1: Prepare Container Images

```bash
# Build images locally
./scripts/deploy.sh build

# Or use CI/CD pipeline (recommended)
git push origin main  # Triggers GitHub Actions
```

### Step 2: Configure Kubernetes Secrets

```bash
# Generate secure secrets
openssl rand -base64 64 > jwt_secret.txt
openssl rand -base64 64 > refresh_secret.txt
openssl rand -base64 32 > encryption_salt.txt

# Apply secrets
kubectl apply -f k8s/secrets-prod.yaml
```

### Step 3: Deploy Infrastructure

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Deploy configuration
kubectl apply -f k8s/configmap.yaml

# Deploy PostgreSQL
kubectl apply -f k8s/postgres-deployment.yaml

# Deploy Redis
kubectl apply -f k8s/redis-deployment.yaml

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n codementor-ai --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n codementor-ai --timeout=300s
```

### Step 4: Deploy Applications

```bash
# Deploy server
kubectl apply -f k8s/server-deployment.yaml

# Deploy client
kubectl apply -f k8s/client-deployment.yaml

# Wait for applications to be ready
kubectl wait --for=condition=ready pod -l app=codementor-server -n codementor-ai --timeout=300s
kubectl wait --for=condition=ready pod -l app=codementor-client -n codementor-ai --timeout=300s
```

### Step 5: Run Database Migrations

```bash
# Get server pod name
SERVER_POD=$(kubectl get pods -n codementor-ai -l app=codementor-server -o jsonpath='{.items[0].metadata.name}')

# Run migrations
kubectl exec -n codementor-ai ${SERVER_POD} -- npm run db:migrate:prod
```

## Database Management

### Migration Strategy

The platform uses Prisma for database migrations with the following strategy:

1. **Development**: `npm run db:migrate` (interactive)
2. **Production**: `npm run db:migrate:prod` (non-interactive)

### Migration Process

```bash
# 1. Create migration in development
cd server
npx prisma migrate dev --name add_new_feature

# 2. Test migration
npm run test

# 3. Deploy to production (automated in deployment)
npm run db:migrate:prod
```

### Rollback Strategy

```bash
# 1. Identify migration to rollback to
npx prisma migrate status

# 2. Reset to specific migration
npx prisma migrate reset --force

# 3. Apply migrations up to desired point
npx prisma migrate deploy
```

## Backup and Recovery

### Automated Backups

Backups are automated using the `scripts/backup-database.sh` script:

```bash
# Manual backup
./scripts/backup-database.sh backup

# Restore from backup
./scripts/backup-database.sh restore /path/to/backup.sql.gz

# Verify backup integrity
./scripts/backup-database.sh verify /path/to/backup.sql.gz
```

### Backup Schedule

Set up automated backups using Kubernetes CronJob:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: database-backup
  namespace: codementor-ai
spec:
  schedule: '0 2 * * *' # Daily at 2 AM
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: codementor-ai/backup:latest
              command: ['/scripts/backup-database.sh', 'backup']
          restartPolicy: OnFailure
```

### Recovery Procedures

#### Database Recovery

```bash
# 1. Stop application pods
kubectl scale deployment codementor-server --replicas=0 -n codementor-ai

# 2. Restore database
./scripts/backup-database.sh restore /path/to/backup.sql.gz

# 3. Restart application pods
kubectl scale deployment codementor-server --replicas=3 -n codementor-ai
```

#### Complete System Recovery

```bash
# 1. Restore infrastructure
kubectl apply -f k8s/

# 2. Restore database
./scripts/backup-database.sh restore /path/to/latest-backup.sql.gz

# 3. Verify system health
./scripts/deploy.sh verify
```

## Monitoring and Observability

### Performance Monitoring Service

The CodeMentor AI platform includes a comprehensive performance monitoring service that provides:

- **Real-time Metrics Collection**: Automatic collection of system and application metrics
- **Intelligent Alerting**: Configurable alert rules with multiple notification channels
- **Performance Reporting**: Automated generation of performance reports with trends
- **System Health Monitoring**: Comprehensive health checks with status indicators

### Health Checks

The application includes comprehensive health checks:

- **Liveness Probe**: `/health` - Basic application health
- **Readiness Probe**: `/health/ready` - Application ready to serve traffic
- **System Health**: `/api/monitoring/health/system` - Comprehensive system health with metrics

### Logging

Centralized logging is configured with:

- **Application Logs**: Structured JSON logs via Winston
- **Access Logs**: nginx access logs
- **System Logs**: Kubernetes system logs
- **Performance Logs**: Metric collection and alert logs

### Metrics Collection

The performance monitoring service automatically collects:

- **Application Metrics**: Response times, error rates, throughput, active users
- **Database Metrics**: Connection pool, query performance, transaction rates
- **Infrastructure Metrics**: CPU usage, memory usage, system load
- **Custom Metrics**: Business-specific metrics via API

### Alert Configuration

Default alert rules are automatically configured for:

- **High Response Time**: > 1000ms for 5 minutes
- **High Error Rate**: > 5% for 3 minutes
- **High Memory Usage**: > 90% for 10 minutes

Additional alert rules can be configured via the monitoring API.

## Security Configuration

### Network Security

```yaml
# Network policies
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: codementor-network-policy
  namespace: codementor-ai
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: ingress-nginx
  egress:
    - to: []
      ports:
        - protocol: TCP
          port: 443
        - protocol: TCP
          port: 80
```

### Pod Security

```yaml
# Pod security context
securityContext:
  runAsNonRoot: true
  runAsUser: 1001
  fsGroup: 1001
  seccompProfile:
    type: RuntimeDefault
```

### Secret Management

- Secrets stored in Kubernetes secrets
- Encryption at rest enabled
- Regular secret rotation recommended

## Performance Optimization

### Resource Limits

```yaml
resources:
  requests:
    memory: '512Mi'
    cpu: '250m'
  limits:
    memory: '1Gi'
    cpu: '500m'
```

### Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: codementor-server-hpa
  namespace: codementor-ai
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: codementor-server
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

## Troubleshooting

### Common Issues

#### Pod Startup Issues

```bash
# Check pod status
kubectl get pods -n codementor-ai

# Check pod logs
kubectl logs -f deployment/codementor-server -n codementor-ai

# Describe pod for events
kubectl describe pod <pod-name> -n codementor-ai
```

#### Database Connection Issues

```bash
# Test database connectivity
kubectl exec -it deployment/codementor-server -n codementor-ai -- npm run db:status

# Check database logs
kubectl logs -f deployment/postgres -n codementor-ai
```

#### Performance Issues

```bash
# Check resource usage
kubectl top pods -n codementor-ai

# Check HPA status
kubectl get hpa -n codementor-ai

# Check node resources
kubectl top nodes
```

### Emergency Procedures

#### Rollback Deployment

```bash
# Rollback to previous version
./scripts/deploy.sh rollback

# Or manually rollback specific deployment
kubectl rollout undo deployment/codementor-server -n codementor-ai
```

#### Scale Down for Maintenance

```bash
# Scale down applications
kubectl scale deployment codementor-server --replicas=0 -n codementor-ai
kubectl scale deployment codementor-client --replicas=0 -n codementor-ai

# Perform maintenance...

# Scale back up
kubectl scale deployment codementor-server --replicas=3 -n codementor-ai
kubectl scale deployment codementor-client --replicas=2 -n codementor-ai
```

## Maintenance Procedures

### Regular Maintenance Tasks

1. **Weekly**:

   - Review application logs
   - Check backup integrity
   - Monitor resource usage

2. **Monthly**:

   - Update dependencies
   - Review security patches
   - Optimize database performance

3. **Quarterly**:
   - Disaster recovery testing
   - Security audit
   - Performance optimization review

### Update Procedures

```bash
# 1. Update application code
git pull origin main

# 2. Build new images
./scripts/deploy.sh build

# 3. Deploy with rolling update
./scripts/deploy.sh deploy

# 4. Verify deployment
./scripts/deploy.sh verify
```

## Support and Documentation

### Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [Prisma Migration Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Node.js Production Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)

### Getting Help

For deployment issues:

1. Check application logs
2. Review this documentation
3. Contact the development team
4. Create an issue in the project repository

---

**Last Updated**: $(date)
**Version**: 1.0.0
