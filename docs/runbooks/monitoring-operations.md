# Monitoring Operations Runbook

## Overview

This runbook covers the operation and maintenance of the CodeMentor AI monitoring and observability systems.

## Monitoring Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │───▶│   Health        │───▶│   Alerting      │
│   Services      │    │   Service       │    │   Service       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Error         │    │   Logger        │    │   Notification  │
│   Tracking      │    │   Service       │    │   Channels      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Health Monitoring

### Health Check Endpoints

#### Basic Health Check
```bash
# Endpoint: GET /health
curl https://api.codementor-ai.com/health

# Expected Response:
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Detailed Health Check
```bash
# Endpoint: GET /health/detailed
curl https://api.codementor-ai.com/health/detailed

# Response includes:
# - Database connectivity and performance
# - Redis connectivity and performance
# - Memory usage
# - Disk space
# - External service availability
```

#### Kubernetes Probes
```bash
# Liveness probe
curl https://api.codementor-ai.com/health/live

# Readiness probe
curl https://api.codementor-ai.com/health/ready
```

### Health Check Troubleshooting

#### Database Health Issues
```bash
# Check database connectivity
kubectl exec -it deployment/postgres -n codementor-ai -- pg_isready -U postgres

# Check database performance
kubectl exec -it deployment/postgres -n codementor-ai -- psql -U postgres -c "
SELECT 
  datname,
  numbackends,
  xact_commit,
  xact_rollback,
  blks_read,
  blks_hit,
  tup_returned,
  tup_fetched,
  tup_inserted,
  tup_updated,
  tup_deleted
FROM pg_stat_database 
WHERE datname = 'codementor_ai';"
```

#### Redis Health Issues
```bash
# Check Redis connectivity
kubectl exec -it deployment/redis -n codementor-ai -- redis-cli ping

# Check Redis performance
kubectl exec -it deployment/redis -n codementor-ai -- redis-cli info stats

# Check Redis memory usage
kubectl exec -it deployment/redis -n codementor-ai -- redis-cli info memory
```

## Error Tracking

### Error Statistics
```bash
# Get error statistics
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.codementor-ai.com/monitoring/errors/stats"

# Get errors for specific time range
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.codementor-ai.com/monitoring/errors/stats?start=2024-01-15T00:00:00Z&end=2024-01-15T23:59:59Z"
```

### Error Investigation
```bash
# Get specific error details
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.codementor-ai.com/monitoring/errors/{errorId}"

# Get errors by fingerprint
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.codementor-ai.com/monitoring/errors/fingerprint/{fingerprint}"
```

### Common Error Patterns

#### Database Connection Errors
- **Fingerprint Pattern**: `database:connection:*`
- **Common Causes**: Connection pool exhaustion, database downtime
- **Investigation**: Check database health, connection limits, pool configuration

#### Authentication Errors
- **Fingerprint Pattern**: `auth:*`
- **Common Causes**: Invalid tokens, expired sessions, permission issues
- **Investigation**: Check JWT configuration, user permissions, session management

#### External Service Errors
- **Fingerprint Pattern**: `external:*`
- **Common Causes**: API rate limits, service downtime, network issues
- **Investigation**: Check external service status, rate limit configuration

## Alert Management

### Alert Statistics
```bash
# Get alert statistics
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.codementor-ai.com/monitoring/alerts/stats"

# Get active alerts
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.codementor-ai.com/monitoring/alerts/active"
```

### Alert Operations
```bash
# Acknowledge alert
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.codementor-ai.com/monitoring/alerts/{alertId}/acknowledge"

# Resolve alert
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.codementor-ai.com/monitoring/alerts/{alertId}/resolve"
```

### Alert Rule Management
```bash
# Get alert rules
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.codementor-ai.com/monitoring/alerts/rules"

# Create new alert rule
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Error Rate",
    "type": "error",
    "condition": "error_rate > 5%",
    "threshold": 5,
    "timeWindow": 15,
    "severity": "high",
    "enabled": true,
    "channels": [
      {
        "type": "email",
        "config": {
          "to": "alerts@codementor-ai.com"
        },
        "enabled": true
      }
    ]
  }' \
  "https://api.codementor-ai.com/monitoring/alerts/rules"
```

### Alert Channels Configuration

#### Email Alerts
```bash
# Environment variables required:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@codementor-ai.com
SMTP_PASS=app-password
ALERT_EMAIL=admin@codementor-ai.com
```

#### Slack Alerts
```json
{
  "type": "slack",
  "config": {
    "webhookUrl": "https://hooks.slack.com/services/...",
    "channel": "#alerts"
  },
  "enabled": true
}
```

#### Webhook Alerts
```json
{
  "type": "webhook",
  "config": {
    "url": "https://your-webhook-endpoint.com/alerts",
    "headers": {
      "Authorization": "Bearer your-token"
    }
  },
  "enabled": true
}
```

## Log Management

### Log Locations
- **Application Logs**: `/app/logs/combined.log`
- **Error Logs**: `/app/logs/error.log`
- **Access Logs**: `/app/logs/access.log`
- **Exception Logs**: `/app/logs/exceptions.log`

### Log Analysis
```bash
# View recent errors
kubectl exec -it deployment/codementor-server -n codementor-ai -- \
  tail -f /app/logs/error.log

# Search for specific errors
kubectl exec -it deployment/codementor-server -n codementor-ai -- \
  grep "database" /app/logs/error.log | tail -20

# View access logs
kubectl exec -it deployment/codementor-server -n codementor-ai -- \
  tail -f /app/logs/access.log
```

### Log Rotation
Logs are automatically rotated when they reach 10MB, keeping 5 files for errors and 10 files for combined logs.

### Structured Log Analysis
```bash
# Parse JSON logs
kubectl logs deployment/codementor-server -n codementor-ai | \
  jq 'select(.level == "error") | {timestamp, message, context}'

# Filter by user
kubectl logs deployment/codementor-server -n codementor-ai | \
  jq 'select(.context.userId == "user123")'

# Filter by request ID
kubectl logs deployment/codementor-server -n codementor-ai | \
  jq 'select(.context.requestId == "req_123")'
```

## Performance Monitoring

### System Metrics
```bash
# Get system metrics
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.codementor-ai.com/monitoring/metrics"

# Response includes:
# - Memory usage (heap, RSS, external)
# - CPU usage (user, system)
# - Process information
# - Uptime
```

### Resource Monitoring
```bash
# Check pod resource usage
kubectl top pods -n codementor-ai

# Check node resource usage
kubectl top nodes

# Check resource limits
kubectl describe pod <pod-name> -n codementor-ai | grep -A 5 "Limits:"
```

### Performance Troubleshooting

#### High Memory Usage
```bash
# Check memory usage trends
kubectl exec -it deployment/codementor-server -n codementor-ai -- \
  node -e "console.log(process.memoryUsage())"

# Check for memory leaks
kubectl logs deployment/codementor-server -n codementor-ai | \
  grep "memory" | tail -20
```

#### High CPU Usage
```bash
# Check CPU usage
kubectl exec -it deployment/codementor-server -n codementor-ai -- \
  node -e "console.log(process.cpuUsage())"

# Check for CPU-intensive operations
kubectl logs deployment/codementor-server -n codementor-ai | \
  grep -E "(slow|timeout|performance)" | tail -20
```

## Real-time Monitoring

### Server-Sent Events
```bash
# Connect to real-time monitoring stream
curl -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream" \
  "https://api.codementor-ai.com/monitoring/events"

# Events include:
# - Health status updates
# - New alerts
# - Error reports
# - Performance metrics
```

### WebSocket Monitoring (if implemented)
```javascript
const ws = new WebSocket('wss://api.codementor-ai.com/monitoring/ws');

ws.on('message', (data) => {
  const event = JSON.parse(data);
  console.log('Monitoring event:', event);
});
```

## Maintenance Tasks

### Daily Tasks
1. Review overnight alerts and errors
2. Check system health dashboard
3. Verify backup completion
4. Monitor resource usage trends

### Weekly Tasks
1. Review error trends and patterns
2. Update alert thresholds if needed
3. Clean up old logs and metrics
4. Review performance metrics

### Monthly Tasks
1. Analyze monitoring effectiveness
2. Update alert rules based on patterns
3. Review and optimize log retention
4. Conduct monitoring system health check

## Troubleshooting Common Issues

### Monitoring Service Not Responding
```bash
# Check monitoring service health
kubectl get pods -l app=codementor-server -n codementor-ai
kubectl logs -f deployment/codementor-server -n codementor-ai

# Restart monitoring service
kubectl rollout restart deployment/codementor-server -n codementor-ai
```

### Alerts Not Being Sent
```bash
# Check alert service configuration
kubectl exec -it deployment/codementor-server -n codementor-ai -- \
  env | grep -E "(SMTP|ALERT)"

# Check alert service logs
kubectl logs deployment/codementor-server -n codementor-ai | \
  grep -E "(alert|notification)"

# Test email configuration
kubectl exec -it deployment/codementor-server -n codementor-ai -- \
  node -e "
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransporter({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    transporter.verify((error, success) => {
      console.log(error ? 'Error: ' + error : 'Success: ' + success);
    });
  "
```

### High Error Rates
```bash
# Identify error patterns
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.codementor-ai.com/monitoring/errors/stats" | \
  jq '.errorsByType'

# Check recent errors
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.codementor-ai.com/monitoring/errors/stats" | \
  jq '.recentErrors[0:5]'

# Investigate specific error types
kubectl logs deployment/codementor-server -n codementor-ai | \
  grep "ERROR" | tail -20
```

## Monitoring Best Practices

### Alert Fatigue Prevention
- Set appropriate thresholds to avoid false positives
- Use alert grouping and deduplication
- Implement alert escalation policies
- Regular review and tuning of alert rules

### Log Management
- Use structured logging (JSON format)
- Include correlation IDs for request tracing
- Set appropriate log levels for different environments
- Implement log aggregation and centralized storage

### Performance Monitoring
- Monitor key business metrics, not just technical metrics
- Set up proactive alerts before issues become critical
- Use percentile-based metrics (P95, P99) for better insights
- Monitor both resource utilization and application performance

---

**Last Updated**: $(date)
**Version**: 1.0.0