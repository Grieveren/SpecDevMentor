import { EventEmitter } from 'events';
import { logger } from './logger.service.js';
import { Request } from 'express';

export interface ErrorReport {
  id: string;
  timestamp: Date;
  error: {
    name: string;
    message: string;
    stack?: string;
  };
  context: {
    userId?: string;
    requestId?: string;
    method?: string;
    url?: string;
    userAgent?: string;
    ip?: string;
    environment: string;
    service: string;
    version: string;
  };
  fingerprint: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  breadcrumbs: Breadcrumb[];
}

export interface Breadcrumb {
  timestamp: Date;
  message: string;
  category: string;
  level: 'info' | 'warning' | 'error';
  data?: Record<string, any>;
}

export interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  recentErrors: ErrorReport[];
  topErrors: Array<{
    fingerprint: string;
    count: number;
    lastSeen: Date;
    error: ErrorReport['error'];
  }>;
}

class ErrorTrackingService extends EventEmitter {
  private errors: Map<string, ErrorReport> = new Map();
  private errorCounts: Map<string, number> = new Map();
  private breadcrumbs: Breadcrumb[] = [];
  private maxBreadcrumbs = 100;
  private maxStoredErrors = 1000;

  constructor() {
    super();
    this.setupCleanup();
  }

  // Track an error
  captureError(error: Error, context: Partial<ErrorReport['context']> = {}): string {
    const errorId = this.generateErrorId();
    const fingerprint = this.generateFingerprint(error);
    const severity = this.determineSeverity(error);

    const errorReport: ErrorReport = {
      id: errorId,
      timestamp: new Date(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context: {
        environment: process.env.NODE_ENV || 'development',
        service: 'codementor-ai-server',
        version: process.env.npm_package_version || '1.0.0',
        ...context,
      },
      fingerprint,
      severity,
      tags: this.generateTags(error, context),
      breadcrumbs: [...this.breadcrumbs],
    };

    // Store error
    this.errors.set(errorId, errorReport);
    
    // Update error counts
    const currentCount = this.errorCounts.get(fingerprint) || 0;
    this.errorCounts.set(fingerprint, currentCount + 1);

    // Log error
    logger.logError(error, {
      errorId,
      fingerprint,
      severity,
      ...context,
    });

    // Emit event for real-time monitoring
    this.emit('error', errorReport);

    // Send alerts for critical errors
    if (severity === 'critical') {
      this.emit('criticalError', errorReport);
    }

    // Cleanup old errors if needed
    this.cleanupOldErrors();

    return errorId;
  }

  // Capture error from Express request
  captureRequestError(error: Error, req: Request): string {
    return this.captureError(error, {
      userId: (req as any).user?.id,
      requestId: (req as any).requestId,
      method: req.method,
      url: req.originalUrl,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    });
  }

  // Add breadcrumb for debugging context
  addBreadcrumb(message: string, category: string, level: 'info' | 'warning' | 'error' = 'info', data?: Record<string, any>): void {
    const breadcrumb: Breadcrumb = {
      timestamp: new Date(),
      message,
      category,
      level,
      data,
    };

    this.breadcrumbs.push(breadcrumb);

    // Keep only recent breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  // Get error statistics
  getErrorStats(timeRange?: { start: Date; end: Date }): ErrorStats {
    let errors = Array.from(this.errors.values());

    // Filter by time range if provided
    if (timeRange) {
      errors = errors.filter(
        error => error.timestamp >= timeRange.start && error.timestamp <= timeRange.end
      );
    }

    // Calculate statistics
    const errorsByType: Record<string, number> = {};
    const errorsBySeverity: Record<string, number> = {};

    errors.forEach(error => {
      errorsByType[error.error.name] = (errorsByType[error.error.name] || 0) + 1;
      errorsBySeverity[error.severity] = (errorsBySeverity[error.severity] || 0) + 1;
    });

    // Get top errors by frequency
    const fingerprintCounts = new Map<string, { count: number; lastError: ErrorReport }>();
    errors.forEach(error => {
      const existing = fingerprintCounts.get(error.fingerprint);
      if (existing) {
        existing.count++;
        if (error.timestamp > existing.lastError.timestamp) {
          existing.lastError = error;
        }
      } else {
        fingerprintCounts.set(error.fingerprint, { count: 1, lastError: error });
      }
    });

    const topErrors = Array.from(fingerprintCounts.entries())
      .map(([fingerprint, data]) => ({
        fingerprint,
        count: data.count,
        lastSeen: data.lastError.timestamp,
        error: data.lastError.error,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors: errors.length,
      errorsByType,
      errorsBySeverity,
      recentErrors: errors
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 20),
      topErrors,
    };
  }

  // Get specific error by ID
  getError(errorId: string): ErrorReport | undefined {
    return this.errors.get(errorId);
  }

  // Get errors by fingerprint
  getErrorsByFingerprint(fingerprint: string): ErrorReport[] {
    return Array.from(this.errors.values()).filter(error => error.fingerprint === fingerprint);
  }

  // Clear all errors (for testing)
  clearErrors(): void {
    this.errors.clear();
    this.errorCounts.clear();
    this.breadcrumbs = [];
  }

  private generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFingerprint(error: Error): string {
    // Create a unique fingerprint based on error type and stack trace
    const stackLines = error.stack?.split('\n').slice(0, 3) || [];
    const fingerprint = `${error.name}:${error.message}:${stackLines.join('|')}`;
    
    // Create hash of fingerprint
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    // Determine severity based on error type and message
    const errorName = error.name.toLowerCase();
    const errorMessage = error.message.toLowerCase();

    // Critical errors
    if (
      errorName.includes('database') ||
      errorName.includes('connection') ||
      errorMessage.includes('econnrefused') ||
      errorMessage.includes('timeout') ||
      errorName === 'syntaxerror'
    ) {
      return 'critical';
    }

    // High severity errors
    if (
      errorName.includes('auth') ||
      errorName.includes('permission') ||
      errorName.includes('security') ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('forbidden')
    ) {
      return 'high';
    }

    // Medium severity errors
    if (
      errorName.includes('validation') ||
      errorName.includes('type') ||
      errorMessage.includes('invalid') ||
      errorMessage.includes('not found')
    ) {
      return 'medium';
    }

    // Default to low severity
    return 'low';
  }

  private generateTags(error: Error, context: Partial<ErrorReport['context']>): string[] {
    const tags: string[] = [];

    // Add error type tag
    tags.push(`error:${error.name.toLowerCase()}`);

    // Add environment tag
    if (context.environment) {
      tags.push(`env:${context.environment}`);
    }

    // Add HTTP method tag
    if (context.method) {
      tags.push(`method:${context.method.toLowerCase()}`);
    }

    // Add URL path tag
    if (context.url) {
      const path = context.url.split('?')[0]; // Remove query params
      tags.push(`path:${path}`);
    }

    // Add user tag if available
    if (context.userId) {
      tags.push(`user:${context.userId}`);
    }

    return tags;
  }

  private cleanupOldErrors(): void {
    if (this.errors.size <= this.maxStoredErrors) {
      return;
    }

    // Sort errors by timestamp and keep only the most recent ones
    const sortedErrors = Array.from(this.errors.entries())
      .sort(([, a], [, b]) => b.timestamp.getTime() - a.timestamp.getTime());

    // Keep only the most recent errors
    const toKeep = sortedErrors.slice(0, this.maxStoredErrors);
    const toRemove = sortedErrors.slice(this.maxStoredErrors);

    // Remove old errors
    toRemove.forEach(([id]) => {
      this.errors.delete(id);
    });

    // Update error counts (remove counts for errors that no longer exist)
    const existingFingerprints = new Set(toKeep.map(([, error]) => error.fingerprint));
    for (const [fingerprint] of this.errorCounts) {
      if (!existingFingerprints.has(fingerprint)) {
        this.errorCounts.delete(fingerprint);
      }
    }
  }

  private setupCleanup(): void {
    // Clean up old errors every hour
    setInterval(() => {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      for (const [id, error] of this.errors) {
        if (error.timestamp < oneWeekAgo) {
          this.errors.delete(id);
        }
      }
    }, 60 * 60 * 1000); // 1 hour
  }
}

// Export singleton instance
export const errorTracker = new ErrorTrackingService();

// Express middleware for error tracking
export const errorTrackingMiddleware = (error: Error, req: any, res: any, next: any) => {
  const errorId = errorTracker.captureRequestError(error, req);
  
  // Add error ID to response for debugging
  res.set('X-Error-ID', errorId);
  
  next(error);
};