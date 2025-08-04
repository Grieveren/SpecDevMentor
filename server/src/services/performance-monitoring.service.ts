// @ts-nocheck
import { PrismaClient } from '@prisma/client';
import { Redis } from 'ioredis';
import { EventEmitter } from 'events';
import { 
  PerformanceMonitoringConfig, 
  ServiceError, 
  ServiceLifecycle, 
  ServiceHealthCheck, 
  ServiceMetrics 
} from '../types/services.js';

interface PerformanceMetric {
  metricType: string;
  value: number;
  unit: string;
  tags?: Record<string, any>;
  timestamp?: Date;
}

interface AlertRule {
  id: string;
  name: string;
  metricType: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  duration: number; // Duration in seconds that condition must be true
  enabled: boolean;
  recipients: string[]; // Email addresses or user IDs
  lastTriggered?: Date;
  cooldownPeriod: number; // Cooldown in seconds before alert can trigger again
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  metricType: string;
  currentValue: number;
  threshold: number;
  condition: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  triggeredAt: Date;
  resolvedAt?: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

interface PerformanceReport {
  period: string;
  startDate: Date;
  endDate: Date;
  metrics: {
    averageResponseTime: number;
    errorRate: number;
    throughput: number;
    activeUsers: number;
    systemLoad: number;
    memoryUsage: number;
    cpuUsage: number;
  };
  trends: {
    metricType: string;
    trend: 'increasing' | 'decreasing' | 'stable';
    changePercent: number;
  }[];
  alerts: Alert[];
  recommendations: string[];
}

export class PerformanceMonitoringService extends EventEmitter {
  private alertRules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private metricBuffer: Map<string, PerformanceMetric[]> = new Map();
  private readonly BUFFER_SIZE = 100;
  private readonly METRIC_RETENTION_HOURS = 24;

  constructor(
    private prisma: PrismaClient,
    private redis: Redis
  ) {
    super();
    this.initializeDefaultAlertRules();
    this.startMetricAggregation();
  }

  // Metric collection
  async recordMetric(metric: PerformanceMetric): Promise<void> {
    try {
      // Store in database
      await this.prisma.systemPerformanceMetrics.create({
        data: {
          metricType: metric.metricType,
          value: metric.value,
          unit: metric.unit,
          tags: metric.tags || {},
          timestamp: metric.timestamp || new Date(),
        },
      });

      // Store in Redis for real-time access
      const redisKey = `metrics:${metric.metricType}`;
      await this.redis.lpush(redisKey, JSON.stringify({
        ...metric,
        timestamp: metric.timestamp || new Date(),
      }));
      await this.redis.ltrim(redisKey, 0, this.BUFFER_SIZE - 1);
      await this.redis.expire(redisKey, this.METRIC_RETENTION_HOURS * 3600);

      // Buffer for alert evaluation
      if (!this.metricBuffer.has(metric.metricType)) {
        this.metricBuffer.set(metric.metricType, []);
      }
      const buffer = this.metricBuffer.get(metric.metricType)!;
      buffer.push(metric);
      if (buffer.length > this.BUFFER_SIZE) {
        buffer.shift();
      }

      // Evaluate alerts
      await this.evaluateAlerts(metric);

      this.emit('metricRecorded', metric);
    } catch (error) {
      console.error('Failed to record metric:', error);
    }
  }

  // Alert management
  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const alertRule: AlertRule = {
      ...rule,
      id: this.generateId(),
    };

    this.alertRules.set(alertRule.id, alertRule);
    
    // Store in Redis for persistence
    await this.redis.hset('alert_rules', alertRule.id, JSON.stringify(alertRule));

    this.emit('alertRuleCreated', alertRule);
    return alertRule;
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    const rule = this.alertRules.get(id);
    if (!rule) return null;

    const updatedRule = { ...rule, ...updates };
    this.alertRules.set(id, updatedRule);
    
    await this.redis.hset('alert_rules', id, JSON.stringify(updatedRule));

    this.emit('alertRuleUpdated', updatedRule);
    return updatedRule;
  }

  async deleteAlertRule(id: string): Promise<boolean> {
    const deleted = this.alertRules.delete(id);
    if (deleted) {
      await this.redis.hdel('alert_rules', id);
      this.emit('alertRuleDeleted', id);
    }
    return deleted;
  }

  async getAlertRules(): Promise<AlertRule[]> {
    return Array.from(this.alertRules.values());
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolvedAt);
  }

  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    await this.redis.hset('active_alerts', alertId, JSON.stringify(alert));

    this.emit('alertAcknowledged', alert);
    return true;
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) return false;

    alert.resolvedAt = new Date();
    await this.redis.hset('active_alerts', alertId, JSON.stringify(alert));

    this.emit('alertResolved', alert);
    return true;
  }

  // Performance reporting
  async generatePerformanceReport(
    period: 'hourly' | 'daily' | 'weekly' | 'monthly',
    startDate?: Date,
    endDate?: Date
  ): Promise<PerformanceReport> {
    const { start, end } = this.calculatePeriodRange(period, startDate, endDate);

    // Get metrics for the period
    const metrics = await this.prisma.systemPerformanceMetrics.findMany({
      where: {
        timestamp: {
          gte: start,
          lte: end,
        },
      },
      orderBy: {
        timestamp: 'asc',
      },
    });

    // Calculate aggregated metrics
    const aggregatedMetrics = this.calculateAggregatedMetrics(metrics);
    
    // Calculate trends
    const trends = await this.calculateTrends(metrics, period);
    
    // Get alerts for the period
    const alerts = Array.from(this.activeAlerts.values()).filter(
      alert => alert.triggeredAt >= start && alert.triggeredAt <= end
    );

    // Generate recommendations
    const recommendations = this.generateRecommendations(aggregatedMetrics, trends, alerts);

    return {
      period,
      startDate: start,
      endDate: end,
      metrics: aggregatedMetrics,
      trends,
      alerts,
      recommendations,
    };
  }

  // Real-time metrics
  async getRealTimeMetrics(metricTypes?: string[]): Promise<Record<string, PerformanceMetric[]>> {
    const result: Record<string, PerformanceMetric[]> = {};
    
    const types = metricTypes || Array.from(this.metricBuffer.keys());
    
    for (const metricType of types) {
      const redisKey = `metrics:${metricType}`;
      const rawMetrics = await this.redis.lrange(redisKey, 0, 50);
      
      result[metricType] = rawMetrics.map(raw => JSON.parse(raw));
    }

    return result;
  }

  // System health check
  async getSystemHealth(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    checks: Array<{
      name: string;
      status: 'pass' | 'fail' | 'warn';
      message: string;
      value?: number;
      threshold?: number;
    }>;
  }> {
    const checks = [];
    let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';

    // Check response time
    const responseTimeMetrics = this.metricBuffer.get('response_time') || [];
    if (responseTimeMetrics.length > 0) {
      const avgResponseTime = responseTimeMetrics
        .slice(-10)
        .reduce((sum, m) => sum + m.value, 0) / Math.min(10, responseTimeMetrics.length);
      
      const responseTimeCheck = {
        name: 'Response Time',
        status: avgResponseTime > 1000 ? 'fail' : avgResponseTime > 500 ? 'warn' : 'pass' as const,
        message: `Average response time: ${avgResponseTime.toFixed(0)}ms`,
        value: avgResponseTime,
        threshold: 500,
      };
      
      checks.push(responseTimeCheck);
      if (responseTimeCheck.status === 'fail') overallStatus = 'critical';
      else if (responseTimeCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'warning';
    }

    // Check error rate
    const errorRateMetrics = this.metricBuffer.get('error_rate') || [];
    if (errorRateMetrics.length > 0) {
      const avgErrorRate = errorRateMetrics
        .slice(-10)
        .reduce((sum, m) => sum + m.value, 0) / Math.min(10, errorRateMetrics.length);
      
      const errorRateCheck = {
        name: 'Error Rate',
        status: avgErrorRate > 5 ? 'fail' : avgErrorRate > 2 ? 'warn' : 'pass' as const,
        message: `Error rate: ${avgErrorRate.toFixed(2)}%`,
        value: avgErrorRate,
        threshold: 2,
      };
      
      checks.push(errorRateCheck);
      if (errorRateCheck.status === 'fail') overallStatus = 'critical';
      else if (errorRateCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'warning';
    }

    // Check memory usage
    const memoryMetrics = this.metricBuffer.get('memory_usage') || [];
    if (memoryMetrics.length > 0) {
      const currentMemory = memoryMetrics[memoryMetrics.length - 1].value;
      
      const memoryCheck = {
        name: 'Memory Usage',
        status: currentMemory > 90 ? 'fail' : currentMemory > 80 ? 'warn' : 'pass' as const,
        message: `Memory usage: ${currentMemory.toFixed(1)}%`,
        value: currentMemory,
        threshold: 80,
      };
      
      checks.push(memoryCheck);
      if (memoryCheck.status === 'fail') overallStatus = 'critical';
      else if (memoryCheck.status === 'warn' && overallStatus === 'healthy') overallStatus = 'warning';
    }

    // Check active alerts
    const activeAlerts = await this.getActiveAlerts();
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;
    const highAlerts = activeAlerts.filter(a => a.severity === 'high').length;

    checks.push({
      name: 'Active Alerts',
      status: criticalAlerts > 0 ? 'fail' : highAlerts > 0 ? 'warn' : 'pass',
      message: `${activeAlerts.length} active alerts (${criticalAlerts} critical, ${highAlerts} high)`,
      value: activeAlerts.length,
    });

    if (criticalAlerts > 0) overallStatus = 'critical';
    else if (highAlerts > 0 && overallStatus === 'healthy') overallStatus = 'warning';

    return {
      status: overallStatus,
      checks,
    };
  }

  // Private methods
  private async evaluateAlerts(metric: PerformanceMetric): Promise<void> {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled || rule.metricType !== metric.metricType) continue;

      // Check cooldown period
      if (rule.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTrigger < rule.cooldownPeriod * 1000) continue;
      }

      // Evaluate condition
      const shouldTrigger = this.evaluateCondition(metric.value, rule.condition, rule.threshold);
      
      if (shouldTrigger) {
        // Check if condition has been true for the required duration
        const buffer = this.metricBuffer.get(metric.metricType) || [];
        const recentMetrics = buffer.slice(-Math.ceil(rule.duration / 10)); // Assuming 10s intervals
        
        const conditionMet = recentMetrics.every(m => 
          this.evaluateCondition(m.value, rule.condition, rule.threshold)
        );

        if (conditionMet && recentMetrics.length >= Math.ceil(rule.duration / 10)) {
          await this.triggerAlert(rule, metric);
        }
      }
    }
  }

  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(rule: AlertRule, metric: PerformanceMetric): Promise<void> {
    const alert: Alert = {
      id: this.generateId(),
      ruleId: rule.id,
      ruleName: rule.name,
      metricType: rule.metricType,
      currentValue: metric.value,
      threshold: rule.threshold,
      condition: rule.condition,
      severity: this.calculateSeverity(metric.value, rule.threshold, rule.condition),
      message: this.generateAlertMessage(rule, metric),
      triggeredAt: new Date(),
      acknowledged: false,
    };

    this.activeAlerts.set(alert.id, alert);
    rule.lastTriggered = new Date();

    // Store in Redis
    await this.redis.hset('active_alerts', alert.id, JSON.stringify(alert));
    await this.redis.hset('alert_rules', rule.id, JSON.stringify(rule));

    // Send notifications
    await this.sendAlertNotifications(alert, rule);

    this.emit('alertTriggered', alert);
  }

  private calculateSeverity(value: number, threshold: number, condition: string): Alert['severity'] {
    const deviation = Math.abs(value - threshold) / threshold;
    
    if (deviation > 0.5) return 'critical';
    if (deviation > 0.3) return 'high';
    if (deviation > 0.1) return 'medium';
    return 'low';
  }

  private generateAlertMessage(rule: AlertRule, metric: PerformanceMetric): string {
    return `${rule.name}: ${metric.metricType} is ${metric.value} ${metric.unit}, which is ${rule.condition.replace('_', ' ')} ${rule.threshold}`;
  }

  private async sendAlertNotifications(alert: Alert, rule: AlertRule): Promise<void> {
    // This would integrate with email service, Slack, etc.
    // // console.log(`ALERT: ${alert.message}`);
    
    // Store notification record
    try {
      // In a real implementation, you'd send emails, Slack messages, etc.
      // For now, we'll just log and emit an event
      this.emit('alertNotificationSent', { alert, recipients: rule.recipients });
    } catch (error) {
      console.error('Failed to send alert notification:', error);
    }
  }

  private calculatePeriodRange(
    period: string,
    startDate?: Date,
    endDate?: Date
  ): { start: Date; end: Date } {
    const end = endDate || new Date();
    let start: Date;

    switch (period) {
      case 'hourly':
        start = new Date(end.getTime() - 60 * 60 * 1000);
        break;
      case 'daily':
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'weekly':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'monthly':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    }

    return { start: startDate || start, end };
  }

  private calculateAggregatedMetrics(metrics: any[]): PerformanceReport['metrics'] {
    const metricsByType = metrics.reduce((acc, metric) => {
      if (!acc[metric.metricType]) acc[metric.metricType] = [];
      acc[metric.metricType].push(metric.value);
      return acc;
    }, {} as Record<string, number[]>);

    const avg = (values: number[]) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;

    return {
      averageResponseTime: avg(metricsByType.response_time || []),
      errorRate: avg(metricsByType.error_rate || []),
      throughput: avg(metricsByType.throughput || []),
      activeUsers: avg(metricsByType.active_users || []),
      systemLoad: avg(metricsByType.system_load || []),
      memoryUsage: avg(metricsByType.memory_usage || []),
      cpuUsage: avg(metricsByType.cpu_usage || []),
    };
  }

  private async calculateTrends(metrics: any[], period: string): Promise<PerformanceReport['trends']> {
    // Simplified trend calculation
    const metricTypes = ['response_time', 'error_rate', 'throughput', 'active_users'];
    const trends: PerformanceReport['trends'] = [];

    for (const metricType of metricTypes) {
      const typeMetrics = metrics.filter(m => m.metricType === metricType);
      if (typeMetrics.length < 2) continue;

      const firstHalf = typeMetrics.slice(0, Math.floor(typeMetrics.length / 2));
      const secondHalf = typeMetrics.slice(Math.floor(typeMetrics.length / 2));

      const firstAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;

      const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;
      
      let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
      if (Math.abs(changePercent) > 5) {
        trend = changePercent > 0 ? 'increasing' : 'decreasing';
      }

      trends.push({
        metricType,
        trend,
        changePercent: Math.abs(changePercent),
      });
    }

    return trends;
  }

  private generateRecommendations(
    metrics: PerformanceReport['metrics'],
    trends: PerformanceReport['trends'],
    alerts: Alert[]
  ): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (metrics.averageResponseTime > 1000) {
      recommendations.push('Consider optimizing database queries and adding caching to improve response times');
    }

    // Error rate recommendations
    if (metrics.errorRate > 2) {
      recommendations.push('Investigate and fix the root causes of errors to improve system reliability');
    }

    // Memory usage recommendations
    if (metrics.memoryUsage > 80) {
      recommendations.push('Monitor memory usage closely and consider scaling up or optimizing memory-intensive operations');
    }

    // Trend-based recommendations
    const responseTimeTrend = trends.find(t => t.metricType === 'response_time');
    if (responseTimeTrend?.trend === 'increasing' && responseTimeTrend.changePercent > 20) {
      recommendations.push('Response times are increasing significantly. Consider performance optimization or scaling');
    }

    // Alert-based recommendations
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    if (criticalAlerts > 0) {
      recommendations.push(`Address ${criticalAlerts} critical alerts immediately to prevent system degradation`);
    }

    return recommendations;
  }

  private initializeDefaultAlertRules(): void {
    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: 'High Response Time',
        metricType: 'response_time',
        condition: 'greater_than',
        threshold: 1000,
        duration: 300, // 5 minutes
        enabled: true,
        recipients: ['admin@codementor-ai.com'],
        cooldownPeriod: 1800, // 30 minutes
      },
      {
        name: 'High Error Rate',
        metricType: 'error_rate',
        condition: 'greater_than',
        threshold: 5,
        duration: 180, // 3 minutes
        enabled: true,
        recipients: ['admin@codementor-ai.com'],
        cooldownPeriod: 900, // 15 minutes
      },
      {
        name: 'High Memory Usage',
        metricType: 'memory_usage',
        condition: 'greater_than',
        threshold: 90,
        duration: 600, // 10 minutes
        enabled: true,
        recipients: ['admin@codementor-ai.com'],
        cooldownPeriod: 3600, // 1 hour
      },
    ];

    defaultRules.forEach(rule => {
      this.createAlertRule(rule);
    });
  }

  private startMetricAggregation(): void {
    // Aggregate metrics every minute
    setInterval(async () => {
      try {
        await this.aggregateMetrics();
      } catch (error) {
        console.error('Error during metric aggregation:', error);
      }
    }, 60000);

    // Clean up old metrics every hour
    setInterval(async () => {
      try {
        await this.cleanupOldMetrics();
      } catch (error) {
        console.error('Error during metric cleanup:', error);
      }
    }, 3600000);
  }

  private async aggregateMetrics(): Promise<void> {
    // Record system metrics
    const systemMetrics = await this.collectSystemMetrics();
    
    for (const metric of systemMetrics) {
      await this.recordMetric(metric);
    }
  }

  private async collectSystemMetrics(): Promise<PerformanceMetric[]> {
    const metrics: PerformanceMetric[] = [];

    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      metrics.push({
        metricType: 'memory_usage',
        value: (memUsage.heapUsed / memUsage.heapTotal) * 100,
        unit: 'percent',
      });

      // CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      metrics.push({
        metricType: 'cpu_usage',
        value: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        unit: 'seconds',
      });

      // Active connections (would need to be tracked separately)
      const activeUsers = await this.redis.scard('active_users') || 0;
      metrics.push({
        metricType: 'active_users',
        value: activeUsers,
        unit: 'count',
      });

    } catch (error) {
      console.error('Error collecting system metrics:', error);
    }

    return metrics;
  }

  private async cleanupOldMetrics(): Promise<void> {
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

    await this.prisma.systemPerformanceMetrics.deleteMany({
      where: {
        timestamp: {
          lt: cutoffDate,
        },
      },
    });
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

