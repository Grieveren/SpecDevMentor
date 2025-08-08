import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CodeExecutionService } from '../services/code-execution.service.js';
import { SupportedLanguage, SecurityError } from '../types/code-execution.js';

describe('CodeExecutionService - Security Tests', () => {
  let service: CodeExecutionService;
  let result: any;

  beforeEach(() => {
    service = new CodeExecutionService();
  });

  afterEach(async () => {
    // Cleanup any remaining sandboxes
    await service.cleanupAllSandboxes();
  });

  describe('Input Validation', () => {
    it('should reject empty code', async () => {
      await expect(
        service.executeCode({
          code: '',
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should reject code exceeding length limit', async () => {
      const longCode = 'a'.repeat(60000);
      
      await expect(
        service.executeCode({
          code: longCode,
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should reject unsupported language', async () => {
      await expect(
        service.executeCode({
          code: 'console.log("test")',
          language: 'unsupported' as SupportedLanguage,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should reject input exceeding length limit', async () => {
      const longInput = 'a'.repeat(15000);
      
      await expect(
        service.executeCode({
          code: 'console.log("test")',
          language: SupportedLanguage.JAVASCRIPT,
          input: longInput,
        })
      ).rejects.toThrow(SecurityError);
    });
  });

  describe('JavaScript Security', () => {
    it('should block file system access', async () => {
      const maliciousCode = `
        const fs = require('fs');
        // // console.log(fs.readFileSync('/etc/passwd', 'utf8'));
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block child process execution', async () => {
      const maliciousCode = `
        const { exec } = require('child_process');
        exec('ls -la', (error, stdout) => // // console.log(stdout));
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block network access', async () => {
      const maliciousCode = `
        const net = require('net');
        const client = net.createConnection(80, 'google.com');
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block eval usage', async () => {
      const maliciousCode = `
        eval('console.log("dangerous")');
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block Function constructor', async () => {
      const maliciousCode = `
        new Function('return process.env')();
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block process object access', async () => {
      const maliciousCode = `
        // // console.log(process.env);
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });
  });

  describe('Python Security', () => {
    it('should block os module import', async () => {
      const maliciousCode = `
import os
print(os.listdir('/'))
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.PYTHON,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block subprocess module', async () => {
      const maliciousCode = `
import subprocess
result = subprocess.run(['ls', '-la'], capture_output=True, text=True)
print(result.stdout)
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.PYTHON,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block socket module', async () => {
      const maliciousCode = `
import socket
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect(('google.com', 80))
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.PYTHON,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block exec function', async () => {
      const maliciousCode = `
exec('print("dangerous")')
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.PYTHON,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block eval function', async () => {
      const maliciousCode = `
eval('print("dangerous")')
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.PYTHON,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block file operations', async () => {
      const maliciousCode = `
with open('/etc/passwd', 'r') as f:
    print(f.read())
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.PYTHON,
        })
      ).rejects.toThrow(SecurityError);
    });
  });

  describe('Java Security', () => {
    it('should block Runtime.getRuntime()', async () => {
      const maliciousCode = `
public class Main {
    public static void main(String[] args) {
        Runtime.getRuntime().exec("ls -la");
    }
}
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVA,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block ProcessBuilder', async () => {
      const maliciousCode = `
import java.io.*;
public class Main {
    public static void main(String[] args) {
        ProcessBuilder pb = new ProcessBuilder("ls", "-la");
    }
}
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVA,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block System.exit', async () => {
      const maliciousCode = `
public class Main {
    public static void main(String[] args) {
        System.exit(1);
    }
}
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVA,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block file operations', async () => {
      const maliciousCode = `
import java.io.*;
public class Main {
    public static void main(String[] args) {
        File file = new File("/etc/passwd");
    }
}
      `;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVA,
        })
      ).rejects.toThrow(SecurityError);
    });
  });

  describe('General Security Patterns', () => {
    it('should block dangerous shell commands', async () => {
      const maliciousCode = `rm -rf /`;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block sudo usage', async () => {
      const maliciousCode = `sudo ls`;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block chmod usage', async () => {
      const maliciousCode = `chmod 777 /etc/passwd`;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block network requests', async () => {
      const maliciousCode = `curl http://malicious-site.com`;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });

    it('should block system file access', async () => {
      const maliciousCode = `cat /etc/passwd`;

      await expect(
        service.executeCode({
          code: maliciousCode,
          language: SupportedLanguage.JAVASCRIPT,
        })
      ).rejects.toThrow(SecurityError);
    });
  });

  describe('Resource Limits', () => {
    it('should enforce timeout limits', async () => {
      const infiniteLoopCode = `
while (true) {
  // Infinite loop
}
      `;

      const startTime = Date.now();
      
       const result = await service.executeCode({
        code: infiniteLoopCode,
        language: SupportedLanguage.JAVASCRIPT,
        timeout: 5000, // 5 seconds
      });

      const executionTime = Date.now() - startTime;
      
      expect(result.timedOut).toBe(true);
      expect(executionTime).toBeLessThan(10000); // Should timeout before 10 seconds
      expect(result.exitCode).toBe(124); // Standard timeout exit code
    });

    it('should handle memory-intensive operations', async () => {
      const memoryIntensiveCode = `
const arr = [];
for (let i = 0; i < 1000000; i++) {
  arr.push('a'.repeat(1000));
}
// // console.log('Memory test completed');
      `;

      // This should either complete or be killed by memory limits
       const result = await service.executeCode({
        code: memoryIntensiveCode,
        language: SupportedLanguage.JAVASCRIPT,
        timeout: 10000,
      });

      // The result should either succeed or fail due to resource limits
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Sandbox Isolation', () => {
    it('should isolate multiple executions', async () => {
      const code1 = `
let globalVar = 'test1';
// // console.log(globalVar);
      `;

      const code2 = `
// // console.log(typeof globalVar === 'undefined' ? 'isolated' : 'not isolated');
      `;

       const [result1, result2] = await Promise.all([
        service.executeCode({
          code: code1,
          language: SupportedLanguage.JAVASCRIPT,
        }),
        service.executeCode({
          code: code2,
          language: SupportedLanguage.JAVASCRIPT,
        }),
      ]);

      expect(result1.success).toBe(true);
      expect(result1.output).toContain('test1');
      expect(result2.success).toBe(true);
      expect(result2.output).toContain('isolated');
    });

    it('should clean up containers after execution', async () => {
      const initialCount = service.getActiveSandboxCount();

      await service.executeCode({
        code: 'console.log("test")',
        language: SupportedLanguage.JAVASCRIPT,
      });

      const finalCount = service.getActiveSandboxCount();
      expect(finalCount).toBe(initialCount);
    });
  });

  describe('Valid Code Execution', () => {
    it('should execute safe JavaScript code', async () => {
      const safeCode = `
const message = 'Hello, World!';
// // console.log(message);
      `;

       result = await service.executeCode({
        code: safeCode,
        language: SupportedLanguage.JAVASCRIPT,
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, World!');
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
    });

    it('should execute safe Python code', async () => {
      const safeCode = `
message = 'Hello, Python!'
print(message)
      `;

       result = await service.executeCode({
        code: safeCode,
        language: SupportedLanguage.PYTHON,
      });

      expect(result.success).toBe(true);
      expect(result.output).toContain('Hello, Python!');
      expect(result.exitCode).toBe(0);
      expect(result.timedOut).toBe(false);
    });

    it('should handle code with syntax errors', async () => {
      const invalidCode = `
// // console.log('missing quote);
      `;

       result = await service.executeCode({
        code: invalidCode,
        language: SupportedLanguage.JAVASCRIPT,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
      expect(result.exitCode).not.toBe(0);
    });

    it('should handle runtime errors', async () => {
      const errorCode = `
throw new Error('Runtime error');
      `;

       result = await service.executeCode({
        code: errorCode,
        language: SupportedLanguage.JAVASCRIPT,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Runtime error');
      expect(result.exitCode).not.toBe(0);
    });
  });
});