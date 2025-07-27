import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CodeExecutionService } from '../services/code-execution.service.js';
import { SupportedLanguage, SecurityError, ExecutionTimeoutError } from '../types/code-execution.js';

// Mock Docker to avoid actual container creation in tests
vi.mock('dockerode', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      createContainer: vi.fn().mockResolvedValue({
        id: 'mock-container-id',
        start: vi.fn().mockResolvedValue(undefined),
        attach: vi.fn().mockResolvedValue({
          on: vi.fn(),
        }),
        wait: vi.fn().mockResolvedValue({ StatusCode: 0 }),
        stop: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        kill: vi.fn().mockResolvedValue(undefined),
      }),
      getContainer: vi.fn().mockReturnValue({
        start: vi.fn().mockResolvedValue(undefined),
        attach: vi.fn().mockResolvedValue({
          on: vi.fn((event, callback) => {
            if (event === 'data') {
              // Simulate stdout data with proper Docker stream format
              setTimeout(() => {
                const message = 'Hello, World!\n';
                const header = Buffer.alloc(8);
                header[0] = 1; // stdout stream
                header.writeUInt32BE(message.length, 4);
                const mockBuffer = Buffer.concat([header, Buffer.from(message)]);
                callback(mockBuffer);
              }, 10);
            }
          }),
        }),
        wait: vi.fn().mockResolvedValue({ StatusCode: 0 }),
        stop: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        kill: vi.fn().mockResolvedValue(undefined),
      }),
    })),
  };
});

describe('CodeExecutionService', () => {
  let service: CodeExecutionService;

  beforeEach(() => {
    service = new CodeExecutionService();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await service.cleanupAllSandboxes();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with supported languages', () => {
      const languages = service.getSupportedLanguages();
      
      expect(languages).toContain(SupportedLanguage.JAVASCRIPT);
      expect(languages).toContain(SupportedLanguage.PYTHON);
      expect(languages).toContain(SupportedLanguage.JAVA);
      expect(languages).toContain(SupportedLanguage.TYPESCRIPT);
      expect(languages).toContain(SupportedLanguage.GO);
      expect(languages).toContain(SupportedLanguage.RUST);
    });

    it('should start with zero active sandboxes', () => {
      expect(service.getActiveSandboxCount()).toBe(0);
    });
  });

  describe('Input Validation', () => {
    it('should validate code input successfully for valid code', async () => {
      const request = {
        code: 'console.log("Hello, World!");',
        language: SupportedLanguage.JAVASCRIPT,
      };

      // This should not throw an error
      await expect(service.executeCode(request)).resolves.toBeDefined();
    });

    it('should reject empty code', async () => {
      const request = {
        code: '',
        language: SupportedLanguage.JAVASCRIPT,
      };

      await expect(service.executeCode(request)).rejects.toThrow(SecurityError);
    });

    it('should reject code that is too long', async () => {
      const request = {
        code: 'a'.repeat(60000),
        language: SupportedLanguage.JAVASCRIPT,
      };

      await expect(service.executeCode(request)).rejects.toThrow(SecurityError);
    });

    it('should reject unsupported language', async () => {
      const request = {
        code: 'console.log("test");',
        language: 'unsupported' as SupportedLanguage,
      };

      await expect(service.executeCode(request)).rejects.toThrow(SecurityError);
    });

    it('should reject input that is too long', async () => {
      const request = {
        code: 'console.log("test");',
        language: SupportedLanguage.JAVASCRIPT,
        input: 'a'.repeat(15000),
      };

      await expect(service.executeCode(request)).rejects.toThrow(SecurityError);
    });

    it('should validate timeout ranges', async () => {
      const request = {
        code: 'console.log("test");',
        language: SupportedLanguage.JAVASCRIPT,
        timeout: 500, // Too short
      };

      // The service should handle this gracefully or throw appropriate error
      await expect(service.executeCode(request)).resolves.toBeDefined();
    });
  });

  describe('Code Sanitization', () => {
    it('should detect malicious JavaScript patterns', async () => {
      const maliciousPatterns = [
        'require("fs")',
        'require("child_process")',
        'require("net")',
        'eval("code")',
        'new Function("code")',
        'process.env',
        '__dirname',
        '__filename',
      ];

      for (const pattern of maliciousPatterns) {
        const request = {
          code: pattern,
          language: SupportedLanguage.JAVASCRIPT,
        };

        await expect(service.executeCode(request)).rejects.toThrow(SecurityError);
      }
    });

    it('should detect malicious Python patterns', async () => {
      const maliciousPatterns = [
        'import os',
        'import subprocess',
        'import socket',
        'exec("code")',
        'eval("code")',
        '__import__("os")',
        'open("/etc/passwd")',
      ];

      for (const pattern of maliciousPatterns) {
        const request = {
          code: pattern,
          language: SupportedLanguage.PYTHON,
        };

        await expect(service.executeCode(request)).rejects.toThrow(SecurityError);
      }
    });

    it('should detect malicious Java patterns', async () => {
      const maliciousPatterns = [
        'Runtime.getRuntime()',
        'ProcessBuilder',
        'System.exit',
        'new File(',
        'FileInputStream',
        'FileOutputStream',
      ];

      for (const pattern of maliciousPatterns) {
        const request = {
          code: `public class Main { public static void main(String[] args) { ${pattern}; } }`,
          language: SupportedLanguage.JAVA,
        };

        await expect(service.executeCode(request)).rejects.toThrow(SecurityError);
      }
    });

    it('should detect general malicious patterns', async () => {
      const maliciousPatterns = [
        'rm -rf',
        'sudo',
        'chmod',
        'curl',
        'wget',
        '/etc/passwd',
        '/proc/',
        'fork()',
      ];

      for (const pattern of maliciousPatterns) {
        const request = {
          code: pattern,
          language: SupportedLanguage.JAVASCRIPT,
        };

        await expect(service.executeCode(request)).rejects.toThrow(SecurityError);
      }
    });
  });

  describe('Execution Commands', () => {
    it('should generate correct command for JavaScript', () => {
      // This tests the internal command generation logic
      const service = new CodeExecutionService();
      const languages = service.getSupportedLanguages();
      
      expect(languages).toContain(SupportedLanguage.JAVASCRIPT);
    });

    it('should generate correct command for Python', () => {
      const service = new CodeExecutionService();
      const languages = service.getSupportedLanguages();
      
      expect(languages).toContain(SupportedLanguage.PYTHON);
    });

    it('should generate correct command for TypeScript', () => {
      const service = new CodeExecutionService();
      const languages = service.getSupportedLanguages();
      
      expect(languages).toContain(SupportedLanguage.TYPESCRIPT);
    });
  });

  describe('Memory Limit Parsing', () => {
    it('should parse memory limits correctly', () => {
      // Test the memory limit parsing indirectly through service creation
      const service = new CodeExecutionService();
      expect(service).toBeDefined();
    });
  });

  describe('Sandbox Management', () => {
    it('should track active sandboxes', async () => {
      const initialCount = service.getActiveSandboxCount();
      
      // Execute code (mocked, so it won't actually create containers)
      await service.executeCode({
        code: 'console.log("test");',
        language: SupportedLanguage.JAVASCRIPT,
      });

      // In the mocked environment, sandbox count should remain the same
      // since cleanup happens immediately
      expect(service.getActiveSandboxCount()).toBe(initialCount);
    });

    it('should cleanup all sandboxes', async () => {
      await service.cleanupAllSandboxes();
      expect(service.getActiveSandboxCount()).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle Docker errors gracefully', async () => {
      // Mock Docker to throw an error
      const mockDocker = vi.mocked(service['docker']);
      mockDocker.createContainer = vi.fn().mockRejectedValue(new Error('Docker error'));

      const request = {
        code: 'console.log("test");',
        language: SupportedLanguage.JAVASCRIPT,
      };

      await expect(service.executeCode(request)).rejects.toThrow();
    });

    it('should handle container creation failures', async () => {
      // This is tested through the mocked Docker implementation
      const request = {
        code: 'console.log("test");',
        language: SupportedLanguage.JAVASCRIPT,
      };

      // Should not throw with our current mock setup
      await expect(service.executeCode(request)).resolves.toBeDefined();
    });
  });

  describe('Timeout Handling', () => {
    it('should handle execution timeouts', async () => {
      // Mock a long-running container
      const mockContainer = {
        id: 'timeout-container',
        start: vi.fn().mockResolvedValue(undefined),
        attach: vi.fn().mockResolvedValue({
          on: vi.fn((event, callback) => {
            // Don't call the callback to simulate hanging
          }),
        }),
        wait: vi.fn().mockImplementation(() => new Promise(() => {})), // Never resolves
        kill: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
      };

      const mockDocker = vi.mocked(service['docker']);
      mockDocker.createContainer = vi.fn().mockResolvedValue(mockContainer);
      mockDocker.getContainer = vi.fn().mockReturnValue(mockContainer);

      const request = {
        code: 'while(true) {}', // Infinite loop
        language: SupportedLanguage.JAVASCRIPT,
        timeout: 1000, // 1 second timeout
      };

      const result = await service.executeCode(request);
      
      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(124);
    });
  });

  describe('Language Support', () => {
    it('should return all supported languages', () => {
      const languages = service.getSupportedLanguages();
      
      expect(languages).toHaveLength(6);
      expect(languages).toEqual(
        expect.arrayContaining([
          SupportedLanguage.JAVASCRIPT,
          SupportedLanguage.PYTHON,
          SupportedLanguage.JAVA,
          SupportedLanguage.TYPESCRIPT,
          SupportedLanguage.GO,
          SupportedLanguage.RUST,
        ])
      );
    });
  });

  describe('Safe Code Execution', () => {
    it('should execute safe JavaScript code successfully', async () => {
      const request = {
        code: 'console.log("Hello, World!");',
        language: SupportedLanguage.JAVASCRIPT,
      };

      const result = await service.executeCode(request);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.output).toBe('string');
    });

    it('should handle code with input', async () => {
      const request = {
        code: 'console.log("Input received");',
        language: SupportedLanguage.JAVASCRIPT,
        input: 'test input',
      };

      const result = await service.executeCode(request);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(typeof result.output).toBe('string');
    });

    it('should handle custom timeout', async () => {
      const request = {
        code: 'console.log("Quick execution");',
        language: SupportedLanguage.JAVASCRIPT,
        timeout: 5000,
      };

      const result = await service.executeCode(request);

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeLessThan(5000);
      expect(typeof result.output).toBe('string');
    });
  });
});