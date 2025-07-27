export interface CodeExecutionRequest {
  code: string;
  language: string;
  input?: string;
  timeout?: number;
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  exitCode: number;
  timedOut: boolean;
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

export interface SpecificationDocument {
  id: string;
  content: string;
  phase: 'requirements' | 'design' | 'tasks';
}

export enum SupportedLanguage {
  JAVASCRIPT = 'javascript',
  PYTHON = 'python',
  JAVA = 'java',
  TYPESCRIPT = 'typescript',
  GO = 'go',
  RUST = 'rust',
}

export interface CodeExecutionState {
  isExecuting: boolean;
  result: ExecutionResult | null;
  error: string | null;
}

export interface ComplianceValidationState {
  isValidating: boolean;
  result: ComplianceResult | null;
  error: string | null;
}