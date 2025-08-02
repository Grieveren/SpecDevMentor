// Service configuration interfaces
export interface AIServiceConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  rateLimitRpm: number;
  rateLimitTpm: number;
  cacheEnabled: boolean;
  cacheTtl: number;
}

export interface NotificationServiceConfig {
  emailProvider: 'smtp' | 'sendgrid' | 'ses';
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  sendgridApiKey?: string;
  sesRegion?: string;
  sesAccessKeyId?: string;
  sesSecretAccessKey?: string;
  defaultFromEmail: string;
  defaultFromName: string;
}

export interface PerformanceMonitoringConfig {
  enabled: boolean;
  metricsInterval: number;
  alertThresholds: {
    cpuUsage: number;
    memoryUsage: number;
    responseTime: number;
    errorRate: number;
  };
  retentionDays: number;
}

export interface LoggingServiceConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'text';
  destination: 'console' | 'file' | 'both';
  filePath?: string;
  maxFileSize: string;
  maxFiles: number;
  enableRequestLogging: boolean;
  enableErrorTracking: boolean;
}

export interface LoggerServiceConfig extends LoggingServiceConfig {
  service: string;
  environment: string;
}

// Service error types
export class ServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class AIServiceError extends ServiceError {
  constructor(message: string, code: string, details?: any) {
    super(message, code, 500, details);
    this.name = 'AIServiceError';
  }
}

export class NotificationServiceError extends ServiceError {
  constructor(message: string, code: string, details?: any) {
    super(message, code, 500, details);
    this.name = 'NotificationServiceError';
  }
}

// Service lifecycle interfaces
export interface ServiceLifecycle {
  initialize(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
  isHealthy(): Promise<boolean>;
}

export interface ServiceHealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: Date;
  responseTime?: number;
  error?: string;
  details?: Record<string, unknown>;
}

export interface ServiceMetrics {
  requestCount: number;
  errorCount: number;
  averageResponseTime: number;
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  customMetrics?: Record<string, number>;
}

// Rate limiting types
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit?: number;
}

// Cache types
export interface CacheOptions {
  ttl?: number;
  key?: string;
  tags?: string[];
}

export interface CacheResult<T> {
  hit: boolean;
  data?: T;
  key: string;
  ttl?: number;
}
