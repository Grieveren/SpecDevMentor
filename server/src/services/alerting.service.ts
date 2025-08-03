// @ts-nocheck
import { EventEmitter } from 'events';
import nodemailer from 'nodemailer';
import { logger } from './logger.service.js';
import { ErrorReport } from './error-tracking.service.js';

export interface Alert {
  id: string;
  type: 'error' | 'performance' | 'security' | 'health' | 'business';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  source: string;
  data: Record<string, any>;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

export interface AlertRule {
  id: string;
  name: string;
  type: Alert['type'];
  condition: string;
  threshold: number;
  timeWindow: number; // in minutes
  severity: Alert['severity'];
  enabled: boolean;
  channels: AlertChannel[];
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'webhook' | 'sms';
  config: Record<string, any>;
  enabled: boolean;
}

export interface AlertStats {
  totalAlerts: number;
  activeAlerts: number;
  alertsByType: Record<string, number>;
  alertsBySeverity: Record<string, number>;
  recentAlerts: Alert[];
}

class AlertingService extends EventEmitter {
  private alerts: Map<string, Alert> = new Map();
  private rules: Map<string, AlertRule> = new Map();
  private emailTransporter: nodemailer.Transporter | null = null;
  private alertCounts: Map<string, { count: number; firstSeen: Date; lastSeen: Date }> = new Map();

  constructor() {
    super();
    this.setupEmailTransporter();
    this.setupDefaultRules();
    this.setupCleanup();
  }

  // Create and send alert
  async createAlert(
    type: Alert['type'],
    severity: Alert['severity'],
    title: string,
    message: string,
    source: string,
    data: Record<string, any> = {}
  ): Promise<string> {
    const alertId = this.generateAlertId();
    
    const alert: Alert = {
      id: alertId,
      type,
      severity,
      title,
      message,
      timestamp: new Date(),
      source,
      data,
      status: 'active',
    };

    // Store alert
    this.alerts.set(alertId, alert);

    // Update alert counts
    const key = `${type}:${title}`;
    const existing = this.alertCounts.get(key);
    if (existing) {
      existing.count++;
      existing.lastSeen = new Date();
    } else {
      this.alertCounts.set(key, {
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
      });
    }

    // Log alert
    logger.info(`Alert created: ${title}`, {
      alertId,
      type,
      severity,
      source,
      data,
    });

    // Send notifications
    await this.sendNotifications(alert);

    // Emit event
    this.emit('alert', alert);

    return alertId;
  }

  // Create alert from error
  async createErrorAlert(errorReport: ErrorReport): Promise<string> {
    const title = `${errorReport.error.name}: ${errorReport.error.message}`;
    const message = `Error occurred in ${errorReport.context.service}\n\nStack trace:\n${errorReport.error.stack}`;

    return this.createAlert(
      'error',
      errorReport.severity,
      title,
      message,
      'error-tracker',
      {
        errorId: errorReport.id,
        fingerprint: errorReport.fingerprint,
        userId: errorReport.context.userId,
        url: errorReport.context.url,
        method: errorReport.context.method,
      }
    );
  }

  // Create performance alert
  async createPerformanceAlert(
    metric: string,
    value: number,
    threshold: number,
    unit: string
  ): Promise<string> {
    const severity = value > threshold * 2 ? 'critical' : value > threshold * 1.5 ? 'high' : 'medium';
    const title = `High ${metric}`;
    const message = `${metric} is ${value}${unit}, which exceeds the threshold of ${threshold}${unit}`;

    return this.createAlert(
      'performance',
      severity,
      title,
      message,
      'performance-monitor',
      { metric, value, threshold, unit }
    );
  }

  // Create health alert
  async createHealthAlert(
    service: string,
    status: 'fail' | 'warn',
    details: string
  ): Promise<string> {
    const severity = status === 'fail' ? 'critical' : 'medium';
    const title = `${service} Health Check ${status === 'fail' ? 'Failed' : 'Warning'}`;
    const message = `Health check for ${service} returned ${status}: ${details}`;

    return this.createAlert(
      'health',
      severity,
      title,
      message,
      'health-monitor',
      { service, status, details }
    );
  }

  // Create security alert
  async createSecurityAlert(
    event: string,
    severity: Alert['severity'],
    details: Record<string, any>
  ): Promise<string> {
    const title = `Security Event: ${event}`;
    const message = `Security event detected: ${event}\n\nDetails: ${JSON.stringify(details, null, 2)}`;

    return this.createAlert(
      'security',
      severity,
      title,
      message,
      'security-monitor',
      details
    );
  }

  // Acknowledge alert
  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status !== 'active') {
      return false;
    }

    alert.status = 'acknowledged';
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    logger.info(`Alert acknowledged: ${alert.title}`, {
      alertId,
      userId,
      acknowledgedAt: alert.acknowledgedAt,
    });

    this.emit('alertAcknowledged', alert);
    return true;
  }

  // Resolve alert
  async resolveAlert(alertId: string, userId?: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert || alert.status === 'resolved') {
      return false;
    }

    alert.status = 'resolved';
    alert.resolvedAt = new Date();

    logger.info(`Alert resolved: ${alert.title}`, {
      alertId,
      userId,
      resolvedAt: alert.resolvedAt,
    });

    this.emit('alertResolved', alert);
    return true;
  }

  // Get alert statistics
  getAlertStats(timeRange?: { start: Date; end: Date }): AlertStats {
    let alerts = Array.from(this.alerts.values());

    // Filter by time range if provided
    if (timeRange) {
      alerts = alerts.filter(
        alert => alert.timestamp >= timeRange.start && alert.timestamp <= timeRange.end
      );
    }

    const alertsByType: Record<string, number> = {};
    const alertsBySeverity: Record<string, number> = {};
    let activeAlerts = 0;

    alerts.forEach(alert => {
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
      
      if (alert.status === 'active') {
        activeAlerts++;
      }
    });

    return {
      totalAlerts: alerts.length,
      activeAlerts,
      alertsByType,
      alertsBySeverity,
      recentAlerts: alerts
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 20),
    };
  }

  // Get active alerts
  getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values())
      .filter(alert => alert.status === 'active')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Get alert by ID
  getAlert(alertId: string): Alert | undefined {
    return this.alerts.get(alertId);
  }

  // Add alert rule
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    logger.info(`Alert rule added: ${rule.name}`, { ruleId: rule.id });
  }

  // Remove alert rule
  removeRule(ruleId: string): boolean {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      logger.info(`Alert rule removed`, { ruleId });
    }
    return removed;
  }

  // Get all rules
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    // Get applicable rules
    const applicableRules = Array.from(this.rules.values()).filter(
      rule => rule.enabled && rule.type === alert.type && rule.severity === alert.severity
    );

    for (const rule of applicableRules) {
      for (const channel of rule.channels) {
        if (!channel.enabled) continue;

        try {
          await this.sendNotification(alert, channel);
        } catch (error) {
          logger.error(`Failed to send alert notification via ${channel.type}`, {
            alertId: alert.id,
            channelType: channel.type,
            error: error.message,
          });
        }
      }
    }
  }

  private async sendNotification(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(alert, channel.config);
        break;
      case 'slack':
        await this.sendSlackNotification(alert, channel.config);
        break;
      case 'webhook':
        await this.sendWebhookNotification(alert, channel.config);
        break;
      default:
        logger.warn(`Unknown alert channel type: ${channel.type}`);
    }
  }

  private async sendEmailNotification(alert: Alert, config: Record<string, any>): Promise<void> {
    if (!this.emailTransporter) {
      throw new Error('Email transporter not configured');
    }

    const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
    const html = this.generateEmailHTML(alert);

    await this.emailTransporter.sendMail({
      from: config.from || process.env.SMTP_USER,
      to: config.to,
      subject,
      html,
    });

    logger.info(`Email alert sent`, {
      alertId: alert.id,
      to: config.to,
      subject,
    });
  }

  private async sendSlackNotification(alert: Alert, config: Record<string, any>): Promise<void> {
    const payload = {
      text: `*${alert.title}*`,
      attachments: [
        {
          color: this.getSeverityColor(alert.severity),
          fields: [
            { title: 'Severity', value: alert.severity, short: true },
            { title: 'Type', value: alert.type, short: true },
            { title: 'Source', value: alert.source, short: true },
            { title: 'Time', value: alert.timestamp.toISOString(), short: true },
          ],
          text: alert.message,
        },
      ],
    };

    const _response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Slack notification failed: ${response.statusText}`);
    }

    logger.info(`Slack alert sent`, { alertId: alert.id });
  }

  private async sendWebhookNotification(alert: Alert, config: Record<string, any>): Promise<void> {
    const _response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: JSON.stringify(alert),
    });

    if (!response.ok) {
      throw new Error(`Webhook notification failed: ${response.statusText}`);
    }

    logger.info(`Webhook alert sent`, { alertId: alert.id, url: config.url });
  }

  private generateEmailHTML(alert: Alert): string {
    return `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto;">
            <div style="background-color: ${this.getSeverityColor(alert.severity)}; color: white; padding: 15px; border-radius: 5px 5px 0 0;">
              <h2 style="margin: 0;">${alert.title}</h2>
              <p style="margin: 5px 0 0 0;">Severity: ${alert.severity.toUpperCase()}</p>
            </div>
            <div style="background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px;">
              <p><strong>Message:</strong></p>
              <p style="background-color: white; padding: 10px; border-left: 3px solid ${this.getSeverityColor(alert.severity)};">
                ${alert.message.replace(/\n/g, '<br>')}
              </p>
              <p><strong>Details:</strong></p>
              <ul>
                <li><strong>Type:</strong> ${alert.type}</li>
                <li><strong>Source:</strong> ${alert.source}</li>
                <li><strong>Time:</strong> ${alert.timestamp.toISOString()}</li>
                <li><strong>Alert ID:</strong> ${alert.id}</li>
              </ul>
              ${Object.keys(alert.data).length > 0 ? `
                <p><strong>Additional Data:</strong></p>
                <pre style="background-color: white; padding: 10px; border-radius: 3px; overflow-x: auto;">
${JSON.stringify(alert.data, null, 2)}
                </pre>
              ` : ''}
            </div>
          </div>
        </body>
      </html>
    `;
  }

  private getSeverityColor(severity: Alert['severity']): string {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  }

  private setupEmailTransporter(): void {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.emailTransporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      logger.info('Email transporter configured');
    } else {
      logger.warn('Email configuration incomplete, email alerts disabled');
    }
  }

  private setupDefaultRules(): void {
    // Critical error rule
    this.addRule({
      id: 'critical-errors',
      name: 'Critical Errors',
      type: 'error',
      condition: 'severity = critical',
      threshold: 1,
      timeWindow: 5,
      severity: 'critical',
      enabled: true,
      channels: [
        {
          type: 'email',
          config: {
            to: process.env.ALERT_EMAIL || 'admin@codementor-ai.com',
          },
          enabled: !!process.env.ALERT_EMAIL,
        },
      ],
    });

    // Health check failures
    this.addRule({
      id: 'health-failures',
      name: 'Health Check Failures',
      type: 'health',
      condition: 'status = fail',
      threshold: 1,
      timeWindow: 5,
      severity: 'critical',
      enabled: true,
      channels: [
        {
          type: 'email',
          config: {
            to: process.env.ALERT_EMAIL || 'admin@codementor-ai.com',
          },
          enabled: !!process.env.ALERT_EMAIL,
        },
      ],
    });

    // Performance degradation
    this.addRule({
      id: 'performance-degradation',
      name: 'Performance Degradation',
      type: 'performance',
      condition: 'severity >= high',
      threshold: 3,
      timeWindow: 15,
      severity: 'high',
      enabled: true,
      channels: [
        {
          type: 'email',
          config: {
            to: process.env.ALERT_EMAIL || 'admin@codementor-ai.com',
          },
          enabled: !!process.env.ALERT_EMAIL,
        },
      ],
    });
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private setupCleanup(): void {
    // Clean up old resolved alerts every day
    setInterval(() => {
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      for (const [id, alert] of this.alerts) {
        if (alert.status === 'resolved' && alert.resolvedAt && alert.resolvedAt < oneMonthAgo) {
          this.alerts.delete(id);
        }
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }
}

// Export singleton instance
export const alertingService = new AlertingService();