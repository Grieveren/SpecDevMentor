import { apiService } from './api.service';
import {
  CodeExecutionRequest,
  ExecutionResult,
  ComplianceResult,
  SpecificationDocument,
  SupportedLanguage,
} from '../types/code-execution';

class CodeExecutionService {
  async executeCode(request: CodeExecutionRequest): Promise<ExecutionResult> {
    try {
      const response = await apiService.post('/code-execution/execute', request);
      return response.data;
    } catch (error) {
      console.error('Code execution failed:', error);
      throw new Error(
        error.response?.data?.message || 'Code execution failed'
      );
    }
  }

  async validateCompliance(
    code: string,
    language: SupportedLanguage,
    specifications: SpecificationDocument[]
  ): Promise<ComplianceResult> {
    try {
      const response = await apiService.post('/code-execution/validate-compliance', {
        code,
        language,
        specifications,
      });
      return response.data;
    } catch (error) {
      console.error('Compliance validation failed:', error);
      throw new Error(
        error.response?.data?.message || 'Compliance validation failed'
      );
    }
  }

  async getSupportedLanguages(): Promise<SupportedLanguage[]> {
    try {
      const response = await apiService.get('/code-execution/languages');
      return response.data.languages;
    } catch (error) {
      console.error('Failed to fetch supported languages:', error);
      throw new Error('Failed to fetch supported languages');
    }
  }

  async getSystemStatus(): Promise<{
    status: string;
    activeSandboxes: number;
    supportedLanguages: number;
    timestamp: string;
  }> {
    try {
      const response = await apiService.get('/code-execution/status');
      return response.data;
    } catch (error) {
      console.error('Failed to fetch system status:', error);
      throw new Error('Failed to fetch system status');
    }
  }
}

export const codeExecutionService = new CodeExecutionService();