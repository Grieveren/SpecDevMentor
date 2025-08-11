# Performance Monitoring Service

## Overview

The CodeMentor AI Performance Monitoring Service provides comprehensive real-time monitoring, alerting, and reporting capabilities for the platform. It automatically collects system and application metrics, evaluates alert conditions, and generates performance reports with actionable recommendations.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │───▶│   Performance   │───▶│   Alert         │
│   Services      │    │   Monitoring    │    │   Manager       │
└─────────────────┘    │   Service       │    └─────────────────┘
                       └─────────────────┘             │
                                │                      ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   Metric        │    │   Notification  │
                       │   Storage       │    │   Channels      │
                       │   (Redis +      │    │   (Email, Slack,│
                       │   PostgreSQL)   │    │   Webhook)      │
                       └─────────────────┘    └─────────────────┘
```

## Features

### Real-time Metrics Collection

- Automatic collection of system metrics (CPU, memory, disk)
- Application performance metrics (response time, throughput, error rate)
- Custom metric recording via API
- Configurable metric retention and buffering

### Intelligent Alerting

- Flexible alert rule configuration with multiple conditions
- Duration-based alert evaluation to prevent false positives
- Cooldown periods to prevent alert spam
- Multiple notification channels (email, Slack, webhook)
- Alert acknowledgment and resolution tracking

### Performance Reporting

- Automated generation of performance reports
- Trend analysis with recommendations
- Configurable reporting periods (hourly, daily, weekly, monthly)
- Business impact correlation

### System Health Monitoring

- Comprehensive health checks with status indicators
- Real-time system health dashboard
- Proactive issue detection and alerting

## API Reference

### Metrics API

#### Record Metric

```http
POST /api/monitoring/metrics
Content-Type: application/json
Authorization: Bearer {token}

{
  "metricType": "response_time",
  "value": 250,
  "unit": "ms",
  "tags": {
    "endpoint": "/api/projects",
    "method": "GET"
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### Get Real-time Metrics

```http
GET /api/monitoring/metrics/realtime?types=response_time,error_rate
Authorization: Bearer {token}
```

Response:

```json
{
  "response_time": [
    {
      "metricType": "response_time",
      "value": 250,
      "unit": "ms",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ],
  "error_rate": [
    {
      "metricType": "error_rate",
      "value": 2.5,
      "unit": "percent",
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

### Alert Management API

#### Create Alert Rule

```http
POST /api/monitoring/alerts/rules
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "High Response Time",
  "metricType": "response_time",
  "condition": "greater_than",
  "threshold": 1000,
  "duration": 300,
  "enabled": true,
  "recipients": ["admin@codementor-ai.com"],
  "cooldownPeriod": 1800
}
```

#### Get Alert Rules

```http
GET /api/monitoring/alerts/rules
Authorization: Bearer {token}
```

#### Update Alert Rule

```http
PUT /api/monitoring/alerts/rules/{ruleId}
Content-Type: application/json
Authorization: Bearer {token}

{
  "threshold": 800,
  "enabled": false
}
```

#### Get Active Alerts

```http
GET /api/monitoring/alerts/active
Authorization: Bearer {token}
```

#### Acknowledge Alert

```http
POST /api/monitoring/alerts/{alertId}/acknowledge
Authorization: Bearer {token}
```

#### Resolve Alert

```http
POST /api/monitoring/alerts/{alertId}/resolve
Authorization: Bearer {token}
```

### Performance Reports API

#### Generate Performance Report

```http
GET /api/monitoring/reports/performance?period=daily&startDate=2024-01-01&endDate=2024-01-07
Authorization: Bearer {token}
```

Response:

```json
{
  "period": "daily",
  "startDate": "2024-01-01T00:00:00.000Z",
  "endDate": "2024-01-07T23:59:59.999Z",
  "metrics": {
    "averageResponseTime": 245.5,
    "errorRate": 1.2,
    "throughput": 150.3,
    "activeUsers": 1250,
    "systemLoad": 0.65,
    "memoryUsage": 72.3,
    "cpuUsage": 45.8
  },
  "trends": [
    {
      "metricType": "response_time",
      "trend": "decreasing",
      "changePercent": 12.5
    }
  ],
  "alerts": [],
  "recommendations": [
    "Response times have improved by 12.5% this week",
    "Consider optimizing memory usage as it's approaching 75%"
  ]
}
```

### System Health API

#### Get System Health

```http
GET /api/monitoring/health/system
Authorization: Bearer {token}
```

Response:

```json
{
  "status": "healthy",
  "checks": [
    {
      "name": "Response Time",
      "status": "pass",
      "message": "Average response time: 245ms",
      "value": 245,
      "threshold": 500
    },
    {
      "name": "Error Rate",
      "status": "pass",
      "message": "Error rate: 1.20%",
      "value": 1.2,
      "threshold": 2
    },
    {
      "name": "Memory Usage",
      "status": "warn",
      "message": "Memory usage: 82.3%",
      "value": 82.3,
      "threshold": 80
    },
    {
      "name": "Active Alerts",
      "status": "pass",
      "message": "0 active alerts (0 critical, 0 high)",
      "value": 0
    }
  ]
}
```

## Configuration

### Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://user:pass@localhost:5432/codementor_ai

# Redis Configuration
REDIS_URL=redis://localhost:6379

# SMTP Configuration for Email Alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@codementor-ai.com
SMTP_PASS=app-password

# Monitoring Configuration
METRIC_RETENTION_HOURS=24
METRIC_BUFFER_SIZE=100
ALERT_COOLDOWN_PERIOD=1800
```

### Default Alert Rules

The service automatically creates the following default alert rules:

1. **High Response Time**

   - Metric: `response_time`
   - Condition: `greater_than`
   - Threshold: 1000ms
   - Duration: 5 minutes
   - Cooldown: 30 minutes

2. **High Error Rate**

   - Metric: `error_rate`
   - Condition: `greater_than`
   - Threshold: 5%
   - Duration: 3 minutes
   - Cooldown: 15 minutes

3. **High Memory Usage**
   - Metric: `memory_usage`
   - Condition: `greater_than`
   - Threshold: 90%
   - Duration: 10 minutes
   - Cooldown: 1 hour

## Usage Examples

### Recording Custom Metrics

```typescript
import { PerformanceMonitoringService } from './services/performance-monitoring.service';

const monitoringService = new PerformanceMonitoringService(prisma, redis);

// Record API response time
await monitoringService.recordMetric({
  metricType: 'response_time',
  value: 245,
  unit: 'ms',
  tags: {
    endpoint: '/api/projects',
    method: 'GET',
    userId: 'user123',
  },
});

// Record custom business metric
await monitoringService.recordMetric({
  metricType: 'project_created',
  value: 1,
  unit: 'count',
  tags: {
    userId: 'user123',
    projectType: 'web_app',
  },
});
```

### Creating Custom Alert Rules

```typescript
// Create alert for high project creation rate
const alertRule = await monitoringService.createAlertRule({
  name: 'High Project Creation Rate',
  metricType: 'project_created',
  condition: 'greater_than',
  threshold: 10,
  duration: 300, // 5 minutes
  enabled: true,
  recipients: ['admin@codementor-ai.com'],
  cooldownPeriod: 3600, // 1 hour
});
```

### Generating Performance Reports

```typescript
// Generate weekly performance report
const report = await monitoringService.generatePerformanceReport(
  'weekly',
  new Date('2024-01-01'),
  new Date('2024-01-07')
);

console.log('Average response time:', report.metrics.averageResponseTime);
console.log('Recommendations:', report.recommendations);
```

### Monitoring Events

```typescript
// Listen for monitoring events
monitoringService.on('alertTriggered', alert => {
  console.log('Alert triggered:', alert.message);
  // Send to external monitoring system
});

monitoringService.on('metricRecorded', metric => {
  console.log('Metric recorded:', metric.metricType, metric.value);
});
```

## Integration

### Express.js Middleware

```typescript
import express from 'express';
import { PerformanceMonitoringService } from './services/performance-monitoring.service';

const app = express();
const monitoring = new PerformanceMonitoringService(prisma, redis);

// Performance monitoring middleware
app.use((req, res, next) => {
  const startTime = Date.now();

  res.on('finish', async () => {
    const responseTime = Date.now() - startTime;

    await monitoring.recordMetric({
      metricType: 'response_time',
      value: responseTime,
      unit: 'ms',
      tags: {
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode.toString(),
      },
    });

    // Record error rate
    if (res.statusCode >= 400) {
      await monitoring.recordMetric({
        metricType: 'error_rate',
        value: 1,
        unit: 'count',
        tags: {
          endpoint: req.path,
          statusCode: res.statusCode.toString(),
        },
      });
    }
  });

  next();
});
```

### React.js Integration

```typescript
import { useEffect, useState } from 'react';

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  checks: HealthCheck[];
}

export const SystemHealthDashboard: React.FC = () => {
  const [health, setHealth] = useState<SystemHealth | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      const response = await fetch('/api/monitoring/health/system');
      const healthData = await response.json();
      setHealth(healthData);
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, []);

  if (!health) return <div>Loading...</div>;

  return (
    <div className="system-health-dashboard">
      <h2>System Health: {health.status}</h2>
      {health.checks.map(check => (
        <div key={check.name} className={`health-check ${check.status}`}>
          <h3>{check.name}</h3>
          <p>{check.message}</p>
          {check.value && <span>Value: {check.value}</span>}
          {check.threshold && <span>Threshold: {check.threshold}</span>}
        </div>
      ))}
    </div>
  );
};
```

## Troubleshooting

### Common Issues

#### Metrics Not Being Recorded

1. Check database connectivity
2. Verify Redis connection
3. Check service initialization
4. Review error logs for metric recording failures

#### Alerts Not Being Sent

1. Verify SMTP configuration
2. Check alert rule configuration
3. Ensure recipients are valid email addresses
4. Check cooldown periods

#### High Memory Usage

1. Review metric retention settings
2. Check buffer sizes
3. Monitor metric cleanup process
4. Consider reducing metric retention period

### Debugging

```typescript
// Enable debug logging
process.env.LOG_LEVEL = 'debug';

// Check service health
const health = await monitoringService.getSystemHealth();
console.log('System health:', health);

// Check active alerts
const alerts = await monitoringService.getActiveAlerts();
console.log('Active alerts:', alerts);

// Check alert rules
const rules = await monitoringService.getAlertRules();
console.log('Alert rules:', rules);
```

## Best Practices

### Metric Collection

- Use consistent metric naming conventions
- Include relevant tags for filtering and grouping
- Avoid high-cardinality tags (e.g., user IDs in metric names)
- Set appropriate metric retention periods

### Alert Configuration

- Set realistic thresholds based on historical data
- Use duration-based alerts to prevent false positives
- Configure appropriate cooldown periods
- Test alert rules before enabling in production

### Performance Optimization

- Use metric buffering for efficient processing
- Implement proper error handling for metric recording
- Monitor the monitoring service itself
- Regular cleanup of old metrics and alerts

---

**Last Updated**: January 2024
**Version**: 1.0.0
