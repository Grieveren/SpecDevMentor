export interface CodeExecutionRequest {
  code: string;
  language: string;
  input?: string;
  timeout?: number;
  memoryLimit?: string;
  cpuLimit?: number;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  memoryUsed?: number;
  exitCode: number;
  timedOut: boolean;
}

export interface SandboxConfig {
  image: string;
  memoryLimit: string;
  cpuLimit: number;
  timeoutMs: number;
  networkMode: 'none' | 'bridge';
  readOnlyRootfs: boolean;
  noNewPrivileges: boolean;
  user: string;
  workingDir: string;
  ulimits: Array<{
    name: string;
    soft: number;
    hard: number;
  }>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ComplianceResult {
  score: number;
  passed: boolean;
  details: ComplianceDetail[];
  suggestions: string[];
}

export interface ComplianceDetail {
  requirement: string;
  status: 'passed' | 'failed' | 'partial';
  message: string;
  evidence?: string;
}

export enum SupportedLanguage {
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  JAVA = 'java',
  TYPESCRIPT = 'typescript',
  GO = 'go',
  RUST = 'rust',
}

export interface Sandbox {
  id: string;
  containerId: string;
  language: SupportedLanguage;
  createdAt: Date;
  lastUsed: Date;
  status: 'running' | 'stopped' | 'error';
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

export class ExecutionTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ExecutionTimeoutError';
  }
}

export class ResourceLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResourceLimitError';
  }
}