// @ts-nocheck
import winston from 'winston';
import path from 'path';
import { Request, Response } from 'express';
import { 
  LoggerServiceConfig, 
  ServiceError, 
  ServiceLifecycle, 
  ServiceHealthCheck, 
  ServiceMetrics 
} from '../types/services.js';


// Log levels
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug',
}

// Log context interface
export interface LogContext {
  userId?: string;
  requestId?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
  method?: string;
  url?: string;
  statusCode?: number;
  responseTime?: number;
  error?: Error;
  [key: string]: unknown;
}

// Structured log entry
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  environment: string;
  context?: LogContext;
  stack?: string;
}

export class LoggerService {
  private logger: winston.Logger;
  private service: string;
  private environment: string;

  constructor() {
    this.service = 'codementor-ai-server';
    this.environment = process.env.NODE_ENV || 'development';
    this.logger = this.createLogger();
  }

  private createLogger(): winston.Logger {
    const logDir = process.env.LOG_DIR || 'logs';
    const logLevel = process.env.LOG_LEVEL || 'info';

    // Custom format for structured logging
    const structuredFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf((info) => {
        const logEntry: LogEntry = {
          level: info.level as LogLevel,
          message: info.message,
          timestamp: info.timestamp,
          service: this.service,
          environment: this.environment,
          context: info.context,
          stack: info.stack,
        };
        return JSON.stringify(logEntry);
      })
    );

    // Console format for development
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf((info) => {
        const { timestamp, level, message, context, stack } = info;
        let log = `${timestamp} [${level}]: ${message}`;
        
        if (context) {
          const contextStr = Object.entries(context)
            .map(([key, value]) => `${key}=${value}`)
            .join(' ');
          log += ` | ${contextStr}`;
        }
        
        if (stack) {
          log += `\n${stack}`;
        }
        
        return log;
      })
    );

    const transports: winston.transport[] = [];

    // Console transport for development
    if (this.environment === 'development') {
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
          level: 'debug',
        })
      );
    } else {
      // Structured JSON logging for production
      transports.push(
        new winston.transports.Console({
          format: structuredFormat,
          level: logLevel,
        })
      );
    }

    // File transports
    transports.push(
      // Error log file
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        format: structuredFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      }),
      
      // Combined log file
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        format: structuredFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 10,
      }),
      
      // HTTP access log
      new winston.transports.File({
        filename: path.join(logDir, 'access.log'),
        level: 'http',
        format: structuredFormat,
        maxsize: 10 * 1024 * 1024, // 10MB
        maxFiles: 5,
      })
    );

    return winston.createLogger({
      level: logLevel,
      transports,
      // Handle uncaught exceptions
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, 'exceptions.log'),
          format: structuredFormat,
        }),
      ],
      // Handle unhandled promise rejections
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logDir, 'rejections.log'),
          format: structuredFormat,
        }),
      ],
    });
  }

  // Core logging methods
  error(message: string, context?: LogContext): void {
    this.logger.error(message, { context });
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, { context });
  }

  info(message: string, context?: LogContext): void {
    this.logger.info(message, { context });
  }

  http(message: string, context?: LogContext): void {
    this.logger.http(message, { context });
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, { context });
  }

  // Specialized logging methods
  logRequest(_req: Request, _res: Response, responseTime: number): void {
    const context: LogContext = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      requestId: (req as any).requestId,
    };

    const message = `${req.method} ${req.originalUrl} ${res.statusCode} - ${responseTime}ms`;
    
    if (res.statusCode >= 500) {
      this.error(message, context);
    } else if (res.statusCode >= 400) {
      this.warn(message, context);
    } else {
      this.http(message, context);
    }
  }

  logError(_error: Error, context?: LogContext): void {
    const errorContext: LogContext = {
      ...context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } as any,
    };

    this.error(error.message, errorContext);
  }

  logDatabaseQuery(query: string, duration: number, context?: LogContext): void {
    const queryContext: LogContext = {
      ...context,
      query,
      duration,
      type: 'database',
    };

    if (duration > 1000) {
      this.warn(`Slow database query: ${duration}ms`, queryContext);
    } else {
      this.debug(`Database query: ${duration}ms`, queryContext);
    }
  }

  logCacheOperation(operation: string, _key: string, hit: boolean, duration: number, context?: LogContext): void {
    const cacheContext: LogContext = {
      ...context,
      operation,
      key,
      hit,
      duration,
      type: 'cache',
    };

    this.debug(`Cache ${operation}: ${hit ? 'HIT' : 'MISS'} - ${duration}ms`, cacheContext);
  }

  logAIOperation(operation: string, model: string, tokens: number, duration: number, context?: LogContext): void {
    const aiContext: LogContext = {
      ...context,
      operation,
      model,
      tokens,
      duration,
      type: 'ai',
    };

    this.info(`AI ${operation}: ${model} - ${tokens} tokens, ${duration}ms`, aiContext);
  }

  logSecurityEvent(_event: string, severity: 'low' | 'medium' | 'high' | 'critical', context?: LogContext): void {
    const securityContext: LogContext = {
      ...context,
      event,
      severity,
      type: 'security',
    };

    const message = `Security event: ${event} (${severity})`;
    
    if (severity === 'critical' || severity === 'high') {
      this.error(message, securityContext);
    } else if (severity === 'medium') {
      this.warn(message, securityContext);
    } else {
      this.info(message, securityContext);
    }
  }

  logPerformanceMetric(metric: string, _value: number, unit: string, context?: LogContext): void {
    const perfContext: LogContext = {
      ...context,
      metric,
      value,
      unit,
      type: 'performance',
    };

    this.info(`Performance metric: ${metric} = ${value}${unit}`, perfContext);
  }

  logBusinessEvent(_event: string, data: Record<string, any>, context?: LogContext): void {
    const businessContext: LogContext = {
      ...context,
      event,
      data,
      type: 'business',
    };

    this.info(`Business event: ${event}`, businessContext);
  }

  // Audit logging
  logAuditEvent(
    action: string,
    resource: string,
    resourceId: string,
    userId: string,
    success: boolean,
    context?: LogContext
  ): void {
    const auditContext: LogContext = {
      ...context,
      action,
      resource,
      resourceId,
      userId,
      success,
      type: 'audit',
    };

    const message = `Audit: ${action} on ${resource}:${resourceId} by user:${userId} - ${success ? 'SUCCESS' : 'FAILED'}`;
    
    if (success) {
      this.info(message, auditContext);
    } else {
      this.warn(message, auditContext);
    }
  }

  // Create child logger with additional context
  child(context: LogContext): LoggerService {
    const childLogger = new LoggerService();
    const originalLog = childLogger.logger.log;
    
    childLogger.logger.log = function(level: unknown, message: unknown, meta: unknown = {}) {
      const mergedMeta = {
        ...meta,
        context: {
          ...context,
          ...meta.context,
        },
      };
      return originalLog.call(this, level, message, mergedMeta);
    };
    
    return childLogger;
  }

  // Get logger instance for direct use
  getLogger(): winston.Logger {
    return this.logger;
  }
}

// Export singleton instance
export const logger = new LoggerService();

// Express middleware for request logging
export const requestLoggingMiddleware = (_req: Request, _res: Response, _next: Function) => {
  const startTime = Date.now();
  
  // Generate request ID
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  (req as any).requestId = requestId;
  
  // Log request start
  logger.debug(`Request started: ${req.method} ${req.originalUrl}`, {
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk: unknown, encoding: unknown) {
    const responseTime = Date.now() - startTime;
    logger.logRequest(req, res, responseTime);
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Error logging middleware
export const errorLoggingMiddleware = (_error: Error, _req: Request, _res: Response, _next: Function) => {
  logger.logError(error, {
    requestId: (req as any).requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id,
  });
  
  next(error);
};