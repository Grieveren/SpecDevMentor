// @ts-nocheck
import Docker from 'dockerode';
import crypto from 'crypto';
import {
  CodeExecutionRequest,
  ExecutionResult,
  SandboxConfig,
  ValidationResult,
  Sandbox,
  SupportedLanguage,
  SecurityError,
  ExecutionTimeoutError,
  ResourceLimitError,
} from '../types/code-execution.js';

export class CodeExecutionService {
  private docker: Docker;
  private activeSandboxes: Map<string, Sandbox> = new Map();
  private readonly SANDBOX_CONFIGS: Record<SupportedLanguage, SandboxConfig>;

  constructor() {
    this.docker = new Docker();
    this.SANDBOX_CONFIGS = {
      [SupportedLanguage.JAVASCRIPT]: {
        image: 'node:18-alpine',
        memoryLimit: '128m',
        cpuLimit: 0.5,
        timeoutMs: 30000,
        networkMode: 'none',
        readOnlyRootfs: true,
        noNewPrivileges: true,
        user: 'node',
        workingDir: '/tmp',
        ulimits: [
          { name: 'nofile', soft: 64, hard: 64 },
          { name: 'nproc', soft: 32, hard: 32 },
        ],
      },
      [SupportedLanguage.PYTHON]: {
        image: 'python:3.11-alpine',
        memoryLimit: '128m',
        cpuLimit: 0.5,
        timeoutMs: 30000,
        networkMode: 'none',
        readOnlyRootfs: true,
        noNewPrivileges: true,
        user: 'nobody',
        workingDir: '/tmp',
        ulimits: [
          { name: 'nofile', soft: 64, hard: 64 },
          { name: 'nproc', soft: 32, hard: 32 },
        ],
      },
      [SupportedLanguage.TYPESCRIPT]: {
        image: 'node:18-alpine',
        memoryLimit: '128m',
        cpuLimit: 0.5,
        timeoutMs: 30000,
        networkMode: 'none',
        readOnlyRootfs: true,
        noNewPrivileges: true,
        user: 'node',
        workingDir: '/tmp',
        ulimits: [
          { name: 'nofile', soft: 64, hard: 64 },
          { name: 'nproc', soft: 32, hard: 32 },
        ],
      },
      [SupportedLanguage.JAVA]: {
        image: 'openjdk:17-alpine',
        memoryLimit: '256m',
        cpuLimit: 0.5,
        timeoutMs: 45000,
        networkMode: 'none',
        readOnlyRootfs: true,
        noNewPrivileges: true,
        user: 'nobody',
        workingDir: '/tmp',
        ulimits: [
          { name: 'nofile', soft: 64, hard: 64 },
          { name: 'nproc', soft: 32, hard: 32 },
        ],
      },
      [SupportedLanguage.GO]: {
        image: 'golang:1.21-alpine',
        memoryLimit: '128m',
        cpuLimit: 0.5,
        timeoutMs: 30000,
        networkMode: 'none',
        readOnlyRootfs: true,
        noNewPrivileges: true,
        user: 'nobody',
        workingDir: '/tmp',
        ulimits: [
          { name: 'nofile', soft: 64, hard: 64 },
          { name: 'nproc', soft: 32, hard: 32 },
        ],
      },
      [SupportedLanguage.RUST]: {
        image: 'rust:1.70-alpine',
        memoryLimit: '256m',
        cpuLimit: 0.5,
        timeoutMs: 60000,
        networkMode: 'none',
        readOnlyRootfs: true,
        noNewPrivileges: true,
        user: 'nobody',
        workingDir: '/tmp',
        ulimits: [
          { name: 'nofile', soft: 64, hard: 64 },
          { name: 'nproc', soft: 32, hard: 32 },
        ],
      },
    };
  }

  async executeCode(_request: CodeExecutionRequest): Promise<ExecutionResult> {
    const startTime = Date.now();

    // Validate input
    const validation = this.validateCodeInput(request);
    if (!validation.isValid) {
      throw new SecurityError(`Invalid code input: ${validation.errors.join(', ')}`);
    }

    const language = request.language as SupportedLanguage;
    const config = this.SANDBOX_CONFIGS[language];

    if (!config) {
      throw new SecurityError(`Unsupported language: ${request.language}`);
    }

    // Sanitize code
    const sanitizedCode = this.sanitizeCode(request.code, language);

    // Create sandbox
    const sandbox = await this.createSandbox(config, sanitizedCode, request.input);

    try {
      // Execute with timeout
      const _result = await this.runWithTimeout(
        sandbox,
        request.timeout || config.timeoutMs
      );

      const executionTime = Date.now() - startTime;

      return {
        success: result.exitCode === 0,
        output: result.stdout,
        error: result.stderr,
        executionTime,
        exitCode: result.exitCode,
        timedOut: result.timedOut,
      };
    } finally {
      // Always cleanup container
      await this.cleanupSandbox(sandbox.containerId);
    }
  }

  async createSandbox(
    config: SandboxConfig,
    code: string,
    input?: string
  ): Promise<Sandbox> {
    const sandboxId = crypto.randomUUID();
    const executionCommand = this.getExecutionCommand(code, config, input);

    try {
      const container = await this.docker.createContainer({
        Image: config.image,
        Cmd: executionCommand,
        HostConfig: {
          Memory: this.parseMemoryLimit(config.memoryLimit),
          CpuQuota: Math.floor(config.cpuLimit * 100000),
          CpuPeriod: 100000,
          NetworkMode: config.networkMode,
          ReadonlyRootfs: config.readOnlyRootfs,
          SecurityOpt: ['no-new-privileges:true'],
          CapDrop: ['ALL'],
          Ulimits: config.ulimits.map(limit => ({
            Name: limit.name,
            Soft: limit.soft,
            Hard: limit.hard,
          })),
        },
        User: config.user,
        WorkingDir: config.workingDir,
        AttachStdout: true,
        AttachStderr: true,
        AttachStdin: !!input,
      });

      const sandbox: Sandbox = {
        id: sandboxId,
        containerId: container.id,
        language: this.getLanguageFromConfig(config),
        createdAt: new Date(),
        lastUsed: new Date(),
        status: 'running',
      };

      this.activeSandboxes.set(sandboxId, sandbox);
      return sandbox;
    } catch (error) {
      throw new ResourceLimitError(`Failed to create sandbox: ${error}`);
    }
  }

  private async runWithTimeout(
    sandbox: Sandbox,
    timeoutMs: number
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    timedOut: boolean;
  }> {
    const container = this.docker.getContainer(sandbox.containerId);

    return new Promise(async (resolve, reject) => {
      let timedOut = false;
      let stdout = '';
      let stderr = '';

      // Set timeout
      const timeout = setTimeout(() => {
        timedOut = true;
        container.kill().catch(() => {
          // Ignore errors when killing container
        });
        resolve({
          stdout,
          stderr: stderr + '\nExecution timed out',
          exitCode: 124, // Standard timeout exit code
          timedOut: true,
        });
      }, timeoutMs);

      try {
        // Start container
        await container.start();

        // Attach to container streams
        const stream = await container.attach({
          stream: true,
          stdout: true,
          stderr: true,
        });

        // Handle output
        stream.on('data', (chunk: Buffer) => {
          const _data = chunk.toString();
          // Docker multiplexes stdout/stderr, first byte indicates stream type
          if (chunk[0] === 1) {
            stdout += data.slice(8); // Remove Docker header
          } else if (chunk[0] === 2) {
            stderr += data.slice(8); // Remove Docker header
          }
        });

        // Wait for container to finish
        const _result = await container.wait();

        clearTimeout(timeout);

        if (!timedOut) {
          resolve({
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            exitCode: result.StatusCode,
            timedOut: false,
          });
        }
      } catch (error) {
        clearTimeout(timeout);
        if (!timedOut) {
          reject(new ExecutionTimeoutError(`Container execution failed: ${error}`));
        }
      }
    });
  }

  private validateCodeInput(_request: CodeExecutionRequest): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check code length
    if (!request.code || request.code.trim().length === 0) {
      errors.push('Code cannot be empty');
    }

    if (request.code.length > 50000) {
      errors.push('Code exceeds maximum length (50KB)');
    }

    // Check for malicious patterns
    if (this.containsMaliciousPatterns(request.code)) {
      errors.push('Code contains potentially dangerous operations');
    }

    // Validate language
    if (!Object.values(SupportedLanguage).includes(request.language as SupportedLanguage)) {
      errors.push(`Unsupported language: ${request.language}`);
    }

    // Check input size
    if (request.input && request.input.length > 10000) {
      errors.push('Input exceeds maximum length (10KB)');
    }

    // Validate timeout
    if (request.timeout && (request.timeout < 1000 || request.timeout > 120000)) {
      warnings.push('Timeout should be between 1-120 seconds');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private sanitizeCode(code: string, language: SupportedLanguage): string {
    // Language-specific dangerous patterns
    const dangerousPatterns: Record<SupportedLanguage, RegExp[]> = {
      [SupportedLanguage.JAVASCRIPT]: [
        /require\s*\(\s*['"]fs['"]/, // File system access
        /require\s*\(\s*['"]child_process['"]/, // Process execution
        /require\s*\(\s*['"]net['"]/, // Network access
        /eval\s*\(/, // Dynamic code execution
        /Function\s*\(/, // Function constructor
        /process\./, // Process object access
        /__dirname|__filename/, // File system paths
      ],
      [SupportedLanguage.PYTHON]: [
        /import\s+os/, // OS module
        /import\s+subprocess/, // Subprocess module
        /import\s+socket/, // Socket module
        /exec\s*\(/, // Dynamic execution
        /eval\s*\(/, // Dynamic evaluation
        /__import__\s*\(/, // Dynamic imports
        /open\s*\(/, // File operations
      ],
      [SupportedLanguage.TYPESCRIPT]: [
        /import.*['"]fs['"]/, // File system
        /import.*['"]child_process['"]/, // Process execution
        /import.*['"]net['"]/, // Network access
        /eval\s*\(/, // Dynamic code execution
        /Function\s*\(/, // Function constructor
        /process\./, // Process object access
      ],
      [SupportedLanguage.JAVA]: [
        /Runtime\.getRuntime\(\)/, // Runtime access
        /ProcessBuilder/, // Process builder
        /System\.exit/, // System exit
        /File\s*\(/, // File operations
        /FileInputStream|FileOutputStream/, // File streams
      ],
      [SupportedLanguage.GO]: [
        /os\.Exec/, // Process execution
        /os\.Exit/, // System exit
        /net\./, // Network operations
        /syscall\./, // System calls
        /unsafe\./, // Unsafe operations
      ],
      [SupportedLanguage.RUST]: [
        /std::process::Command/, // Process execution
        /std::fs::/, // File system
        /std::net::/, // Network operations
        /unsafe\s*{/, // Unsafe blocks
      ],
    };

    const patterns = dangerousPatterns[language] || [];

    for (const pattern of patterns) {
      if (pattern.test(code)) {
        throw new SecurityError(`Code contains potentially dangerous operations: ${pattern}`);
      }
    }

    return code;
  }

  private containsMaliciousPatterns(code: string): boolean {
    const maliciousPatterns = [
      /rm\s+-rf/, // Dangerous file operations
      /sudo/, // Privilege escalation
      /chmod/, // Permission changes
      /curl|wget/, // Network requests
      /\/etc\/passwd/, // System files
      /\/proc\//, // Process information
      /fork\(\)/, // Process forking
    ];

    return maliciousPatterns.some(pattern => pattern.test(code));
  }

  private getExecutionCommand(
    code: string,
    config: SandboxConfig,
    input?: string
  ): string[] {
    const language = this.getLanguageFromConfig(config);

    switch (language) {
      case SupportedLanguage.JAVASCRIPT:
        return ['node', '-e', code];

      case SupportedLanguage.PYTHON:
        return ['python3', '-c', code];

      case SupportedLanguage.TYPESCRIPT:
        // For TypeScript, we'll use ts-node or compile to JS
        return ['npx', 'ts-node', '-e', code];

      case SupportedLanguage.JAVA:
        // For Java, we need to create a temporary file
        return [
          'sh',
          '-c',
          `echo '${code.replace(/'/g, "'\\''")}' > Main.java && javac Main.java && java Main`,
        ];

      case SupportedLanguage.GO:
        return ['go', 'run', '-'];

      case SupportedLanguage.RUST:
        return [
          'sh',
          '-c',
          `echo '${code.replace(/'/g, "'\\''")}' > main.rs && rustc main.rs && ./main`,
        ];

      default:
        throw new SecurityError(`Unsupported language: ${language}`);
    }
  }

  private getLanguageFromConfig(config: SandboxConfig): SupportedLanguage {
    // Find language by matching config
    for (const [lang, langConfig] of Object.entries(this.SANDBOX_CONFIGS)) {
      if (langConfig.image === config.image) {
        return lang as SupportedLanguage;
      }
    }
    throw new Error('Unknown language configuration');
  }

  private parseMemoryLimit(limit: string): number {
    const match = limit.match(/^(\d+)([kmg]?)$/i);
    if (!match) {
      throw new Error(`Invalid memory limit format: ${limit}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2]?.toLowerCase() || '';

    switch (unit) {
      case 'k':
        return value * 1024;
      case 'm':
        return value * 1024 * 1024;
      case 'g':
        return value * 1024 * 1024 * 1024;
      default:
        return value;
    }
  }

  async cleanupSandbox(containerId: string): Promise<void> {
    try {
      const container = this.docker.getContainer(containerId);
      
      // Stop container if running
      try {
        await container.stop({ t: 5 }); // 5 second grace period
      } catch (error) {
        // Container might already be stopped
      }

      // Remove container
      await container.remove({ force: true });

      // Remove from active sandboxes
      for (const [id, sandbox] of this.activeSandboxes.entries()) {
        if (sandbox.containerId === containerId) {
          this.activeSandboxes.delete(id);
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to cleanup sandbox ${containerId}:`, error);
    }
  }

  async cleanupAllSandboxes(): Promise<void> {
    const cleanupPromises = Array.from(this.activeSandboxes.values()).map(sandbox =>
      this.cleanupSandbox(sandbox.containerId)
    );

    await Promise.allSettled(cleanupPromises);
    this.activeSandboxes.clear();
  }

  getSupportedLanguages(): SupportedLanguage[] {
    return Object.values(SupportedLanguage);
  }

  getActiveSandboxCount(): number {
    return this.activeSandboxes.size;
  }
}