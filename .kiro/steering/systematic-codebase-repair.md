# Systematic Codebase Repair Patterns

## Repair Strategy Framework

### Layered Repair Approach

```typescript
interface RepairStrategy {
  layers: RepairLayer[];
  validationCheckpoints: ValidationCheckpoint[];
  rollbackCapability: RollbackStrategy;
  progressTracking: ProgressTracker;
}

enum RepairLayer {
  FOUNDATION = 'foundation', // Dependencies, configs, types
  COMPILATION = 'compilation', // TypeScript errors
  BUILD = 'build', // Build processes
  TESTING = 'testing', // Test suites
  INTEGRATION = 'integration', // Client-server integration
  PRODUCTION = 'production', // Production optimization
}

interface RepairPhase {
  layer: RepairLayer;
  priority: 'critical' | 'high' | 'medium' | 'low';
  dependencies: RepairLayer[];
  estimatedDuration: number; // minutes
  validationCriteria: ValidationCriteria[];
  rollbackPoint: string;
}
```

### Foundation Layer Repair Patterns

#### Dependency Conflict Resolution

```typescript
class DependencyConflictResolver {
  async resolveDependencyConflicts(workspaceRoot: string): Promise<ResolutionResult> {
    const conflicts = await this.detectConflicts(workspaceRoot);
    const resolutionPlan = this.generateResolutionPlan(conflicts);

    return await this.executeResolution(resolutionPlan);
  }

  private async detectConflicts(workspaceRoot: string): Promise<DependencyConflict[]> {
    const conflicts: DependencyConflict[] = [];

    // 1. Check for version mismatches across workspaces
    const workspaces = await this.getWorkspaces(workspaceRoot);
    const dependencyMap = new Map<string, WorkspaceDependency[]>();

    for (const workspace of workspaces) {
      const packageJson = await this.readPackageJson(workspace.path);

      for (const [name, version] of Object.entries(packageJson.dependencies || {})) {
        if (!dependencyMap.has(name)) {
          dependencyMap.set(name, []);
        }
        dependencyMap.get(name)!.push({
          workspace: workspace.name,
          version: version as string,
          type: 'dependency',
        });
      }
    }

    // 2. Identify conflicts
    for (const [packageName, dependencies] of dependencyMap) {
      const uniqueVersions = [...new Set(dependencies.map(d => d.version))];

      if (uniqueVersions.length > 1) {
        conflicts.push({
          package: packageName,
          conflictingVersions: dependencies,
          severity: this.assessConflictSeverity(packageName, uniqueVersions),
          resolutionStrategy: this.determineResolutionStrategy(packageName, dependencies),
        });
      }
    }

    return conflicts;
  }

  private generateResolutionPlan(conflicts: DependencyConflict[]): ResolutionPlan {
    // Sort by severity and impact
    const sortedConflicts = conflicts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    const plan: ResolutionPlan = {
      phases: [],
      estimatedTime: 0,
      riskLevel: 'medium',
    };

    // Phase 1: Critical TypeScript/React version conflicts
    const criticalConflicts = sortedConflicts.filter(c => c.severity === 'critical');
    if (criticalConflicts.length > 0) {
      plan.phases.push({
        name: 'Critical Dependency Resolution',
        conflicts: criticalConflicts,
        actions: criticalConflicts.map(c => this.createResolutionAction(c)),
        estimatedTime: criticalConflicts.length * 10,
      });
    }

    // Phase 2: High priority conflicts
    const highConflicts = sortedConflicts.filter(c => c.severity === 'high');
    if (highConflicts.length > 0) {
      plan.phases.push({
        name: 'High Priority Resolution',
        conflicts: highConflicts,
        actions: highConflicts.map(c => this.createResolutionAction(c)),
        estimatedTime: highConflicts.length * 5,
      });
    }

    plan.estimatedTime = plan.phases.reduce((sum, phase) => sum + phase.estimatedTime, 0);

    return plan;
  }
}
```

#### TypeScript Configuration Harmonization

```typescript
class TypeScriptConfigHarmonizer {
  async harmonizeConfigurations(monorepoRoot: string): Promise<HarmonizationResult> {
    const configs = await this.discoverTSConfigs(monorepoRoot);
    const conflicts = this.detectConfigConflicts(configs);
    const harmonizedConfigs = this.generateHarmonizedConfigs(configs, conflicts);

    return await this.applyHarmonizedConfigs(harmonizedConfigs);
  }

  private generateHarmonizedConfigs(
    configs: TSConfigFile[],
    conflicts: ConfigConflict[]
  ): HarmonizedTSConfig {
    const baseConfig: TSConfigBase = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true, // Initially true for faster compilation
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', 'build'],
    };

    const clientConfig: TSConfigClient = {
      ...baseConfig,
      compilerOptions: {
        ...baseConfig.compilerOptions,
        jsx: 'react-jsx',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
        moduleResolution: 'bundler',
        noEmit: true, // Vite handles emission
        allowImportingTsExtensions: true,
        isolatedModules: true,
      },
    };

    const serverConfig: TSConfigServer = {
      ...baseConfig,
      compilerOptions: {
        ...baseConfig.compilerOptions,
        moduleResolution: 'node',
        outDir: './dist',
        noEmit: false,
        allowImportingTsExtensions: false,
        types: ['node'],
      },
    };

    return {
      root: baseConfig,
      client: clientConfig,
      server: serverConfig,
      shared: this.generateSharedConfig(baseConfig),
    };
  }
}
```

### Compilation Layer Repair Patterns

#### Incremental Error Resolution

```typescript
class IncrementalErrorResolver {
  async resolveErrorsInBatches(
    projectPath: string,
    batchSize: number = 15
  ): Promise<ResolutionProgress> {
    const progress: ResolutionProgress = {
      totalErrors: 0,
      resolvedErrors: 0,
      remainingErrors: 0,
      batches: [],
      currentBatch: 0,
    };

    let iteration = 1;
    const maxIterations = 20;

    while (iteration <= maxIterations) {
      console.log(`🔄 Error resolution iteration ${iteration}/${maxIterations}`);

      // 1. Get current error state
      const errors = await this.getTypeScriptErrors(projectPath);
      progress.totalErrors = errors.length;

      if (errors.length === 0) {
        console.log('🎉 All TypeScript errors resolved!');
        break;
      }

      // 2. Categorize and prioritize errors
      const categorized = await this.categorizeErrors(errors);
      const batch = this.selectErrorBatch(categorized, batchSize);

      console.log(`📊 Processing batch of ${batch.length} errors`);

      // 3. Apply fixes for current batch
      const batchResult = await this.processBatch(batch);
      progress.batches.push(batchResult);

      // 4. Validate fixes don't introduce new errors
      const validationResult = await this.validateBatch(projectPath, batchResult);

      if (!validationResult.success) {
        console.log('⚠️  Batch validation failed, rolling back...');
        await this.rollbackBatch(batchResult);
        break;
      }

      // 5. Commit successful fixes
      await this.commitBatch(batchResult);
      progress.resolvedErrors += batchResult.successfulFixes.length;

      iteration++;
    }

    progress.remainingErrors = progress.totalErrors - progress.resolvedErrors;
    return progress;
  }

  private async processBatch(batch: TypeScriptError[]): Promise<BatchResult> {
    const result: BatchResult = {
      batchId: Date.now().toString(),
      errors: batch,
      successfulFixes: [],
      failedFixes: [],
      skippedFixes: [],
    };

    for (const error of batch) {
      try {
        const fixResult = await this.applyErrorFix(error);

        if (fixResult.success) {
          result.successfulFixes.push(fixResult);
        } else {
          result.failedFixes.push(fixResult);
        }
      } catch (fixError) {
        result.failedFixes.push({
          error,
          success: false,
          message: `Fix application failed: ${fixError.message}`,
        });
      }
    }

    return result;
  }

  private selectErrorBatch(categorized: CategorizedErrors, batchSize: number): TypeScriptError[] {
    const batch: TypeScriptError[] = [];

    // Priority order: critical auto-fixable, high auto-fixable, critical manual, etc.
    const priorityOrder = [
      categorized.critical.filter(e => e.strategy?.autoFixable),
      categorized.high.filter(e => e.strategy?.autoFixable),
      categorized.critical.filter(e => !e.strategy?.autoFixable),
      categorized.high.filter(e => !e.strategy?.autoFixable),
      categorized.medium.filter(e => e.strategy?.autoFixable),
      categorized.low.filter(e => e.strategy?.autoFixable),
    ];

    for (const group of priorityOrder) {
      for (const error of group) {
        if (batch.length >= batchSize) break;
        batch.push(error);
      }
      if (batch.length >= batchSize) break;
    }

    return batch;
  }
}
```

### Build Layer Repair Patterns

#### Build Process Restoration

```typescript
class BuildProcessRestorer {
  async restoreBuildProcesses(projectRoot: string): Promise<BuildRestorationResult> {
    const result: BuildRestorationResult = {
      clientBuild: { status: 'pending', errors: [], warnings: [] },
      serverBuild: { status: 'pending', errors: [], warnings: [] },
      overallSuccess: false,
    };

    try {
      // 1. Restore client build process
      console.log('🔧 Restoring client build process...');
      result.clientBuild = await this.restoreClientBuild(projectRoot);

      // 2. Restore server build process
      console.log('🔧 Restoring server build process...');
      result.serverBuild = await this.restoreServerBuild(projectRoot);

      // 3. Validate build artifacts
      if (result.clientBuild.status === 'success' && result.serverBuild.status === 'success') {
        console.log('✅ Validating build artifacts...');
        const artifactValidation = await this.validateBuildArtifacts(projectRoot);
        result.overallSuccess = artifactValidation.success;
      }
    } catch (error) {
      console.error('❌ Build restoration failed:', error);
      result.overallSuccess = false;
    }

    return result;
  }

  private async restoreClientBuild(projectRoot: string): Promise<BuildResult> {
    const clientPath = path.join(projectRoot, 'client');

    try {
      // 1. Check Vite configuration
      const viteConfigPath = path.join(clientPath, 'vite.config.ts');
      if (!fs.existsSync(viteConfigPath)) {
        await this.createDefaultViteConfig(viteConfigPath);
      }

      // 2. Validate TypeScript configuration for client
      const tsConfigPath = path.join(clientPath, 'tsconfig.json');
      await this.validateClientTSConfig(tsConfigPath);

      // 3. Attempt build with timeout protection
      const buildCommand = 'npm run build:client';
      const buildResult = await this.executeBuildWithTimeout(buildCommand, 300); // 5 minutes

      if (buildResult.success) {
        // 4. Validate build artifacts
        const distPath = path.join(clientPath, 'dist');
        const artifactValidation = await this.validateClientArtifacts(distPath);

        return {
          status: artifactValidation.success ? 'success' : 'failed',
          errors: artifactValidation.errors,
          warnings: artifactValidation.warnings,
          buildTime: buildResult.duration,
          artifactSize: artifactValidation.totalSize,
        };
      } else {
        return {
          status: 'failed',
          errors: [buildResult.error],
          warnings: [],
          buildTime: buildResult.duration,
        };
      }
    } catch (error) {
      return {
        status: 'failed',
        errors: [`Client build restoration failed: ${error.message}`],
        warnings: [],
      };
    }
  }

  private async executeBuildWithTimeout(
    command: string,
    timeoutSeconds: number
  ): Promise<BuildExecutionResult> {
    const startTime = Date.now();

    try {
      const result = await new Promise<BuildExecutionResult>((resolve, reject) => {
        const process = spawn('bash', ['-c', command], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';

        process.stdout.on('data', data => {
          stdout += data.toString();
        });

        process.stderr.on('data', data => {
          stderr += data.toString();
        });

        const timeout = setTimeout(() => {
          process.kill('SIGTERM');
          reject(new Error(`Build timed out after ${timeoutSeconds} seconds`));
        }, timeoutSeconds * 1000);

        process.on('close', code => {
          clearTimeout(timeout);
          const duration = Date.now() - startTime;

          if (code === 0) {
            resolve({
              success: true,
              stdout,
              stderr,
              duration,
            });
          } else {
            resolve({
              success: false,
              stdout,
              stderr,
              duration,
              error: `Build failed with exit code ${code}`,
            });
          }
        });

        process.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      return result;
    } catch (error) {
      return {
        success: false,
        stdout: '',
        stderr: '',
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }
}
```

### Testing Layer Repair Patterns

#### Test Suite Recovery

```typescript
class TestSuiteRecoverer {
  async recoverTestSuites(projectRoot: string): Promise<TestRecoveryResult> {
    const result: TestRecoveryResult = {
      clientTests: { status: 'pending', passRate: 0, coverage: 0 },
      serverTests: { status: 'pending', passRate: 0, coverage: 0 },
      overallSuccess: false,
    };

    try {
      // 1. Fix test configurations
      await this.fixTestConfigurations(projectRoot);

      // 2. Resolve test-specific TypeScript errors
      await this.resolveTestTypeScriptErrors(projectRoot);

      // 3. Update test dependencies
      await this.updateTestDependencies(projectRoot);

      // 4. Run client tests
      result.clientTests = await this.runClientTests(projectRoot);

      // 5. Run server tests
      result.serverTests = await this.runServerTests(projectRoot);

      // 6. Validate overall test health
      result.overallSuccess = this.validateTestHealth(result);
    } catch (error) {
      console.error('❌ Test suite recovery failed:', error);
      result.overallSuccess = false;
    }

    return result;
  }

  private async fixTestConfigurations(projectRoot: string): Promise<void> {
    // 1. Fix Jest configuration conflicts
    const jestConfigPath = path.join(projectRoot, 'jest.config.js');
    if (fs.existsSync(jestConfigPath)) {
      await this.validateJestConfig(jestConfigPath);
    }

    // 2. Fix Vitest configuration for client
    const vitestConfigPath = path.join(projectRoot, 'client', 'vitest.config.ts');
    if (fs.existsSync(vitestConfigPath)) {
      await this.validateVitestConfig(vitestConfigPath);
    }

    // 3. Ensure test environment setup
    await this.setupTestEnvironments(projectRoot);
  }

  private async runClientTests(projectRoot: string): Promise<TestSuiteResult> {
    const clientPath = path.join(projectRoot, 'client');

    try {
      const testCommand = 'npm run test -- --run --coverage --timeout=30000';
      const testResult = await this.executeTestWithTimeout(testCommand, clientPath, 180);

      if (testResult.success) {
        const coverage = this.extractCoverageFromOutput(testResult.stdout);
        const passRate = this.extractPassRateFromOutput(testResult.stdout);

        return {
          status: 'success',
          passRate,
          coverage,
          duration: testResult.duration,
          output: testResult.stdout,
        };
      } else {
        return {
          status: 'failed',
          passRate: 0,
          coverage: 0,
          duration: testResult.duration,
          output: testResult.stderr,
          errors: [testResult.error || 'Test execution failed'],
        };
      }
    } catch (error) {
      return {
        status: 'failed',
        passRate: 0,
        coverage: 0,
        errors: [`Client test execution failed: ${error.message}`],
      };
    }
  }

  private validateTestHealth(result: TestRecoveryResult): boolean {
    const minPassRate = 0.8; // 80% minimum pass rate
    const minCoverage = 0.6; // 60% minimum coverage

    const clientHealthy =
      result.clientTests.status === 'success' &&
      result.clientTests.passRate >= minPassRate &&
      result.clientTests.coverage >= minCoverage;

    const serverHealthy =
      result.serverTests.status === 'success' &&
      result.serverTests.passRate >= minPassRate &&
      result.serverTests.coverage >= minCoverage;

    return clientHealthy && serverHealthy;
  }
}
```

### Progress Tracking and Validation

#### Continuous Validation Framework

```typescript
class ContinuousValidator {
  private validationHistory: ValidationSnapshot[] = [];

  async validateRepairProgress(
    projectRoot: string,
    currentPhase: RepairLayer
  ): Promise<ValidationResult> {
    const snapshot: ValidationSnapshot = {
      timestamp: new Date(),
      phase: currentPhase,
      metrics: await this.collectMetrics(projectRoot),
      validationResults: {},
    };

    // Run phase-specific validations
    switch (currentPhase) {
      case RepairLayer.FOUNDATION:
        snapshot.validationResults.foundation = await this.validateFoundation(projectRoot);
        break;

      case RepairLayer.COMPILATION:
        snapshot.validationResults.compilation = await this.validateCompilation(projectRoot);
        break;

      case RepairLayer.BUILD:
        snapshot.validationResults.build = await this.validateBuild(projectRoot);
        break;

      case RepairLayer.TESTING:
        snapshot.validationResults.testing = await this.validateTesting(projectRoot);
        break;

      case RepairLayer.INTEGRATION:
        snapshot.validationResults.integration = await this.validateIntegration(projectRoot);
        break;

      case RepairLayer.PRODUCTION:
        snapshot.validationResults.production = await this.validateProduction(projectRoot);
        break;
    }

    this.validationHistory.push(snapshot);

    return this.generateValidationReport(snapshot);
  }

  private async validateFoundation(projectRoot: string): Promise<FoundationValidation> {
    return {
      dependenciesInstalled: await this.checkDependenciesInstalled(projectRoot),
      configurationValid: await this.checkConfigurationValidity(projectRoot),
      typeScriptConfigured: await this.checkTypeScriptConfiguration(projectRoot),
      moduleResolutionWorking: await this.checkModuleResolution(projectRoot),
    };
  }

  private async validateCompilation(projectRoot: string): Promise<CompilationValidation> {
    const tsErrors = await this.getTypeScriptErrors(projectRoot);

    return {
      errorCount: tsErrors.length,
      errorsByCategory: this.categorizeErrorsByType(tsErrors),
      compilationTime: await this.measureCompilationTime(projectRoot),
      strictModeEnabled: await this.checkStrictMode(projectRoot),
    };
  }

  generateProgressReport(): ProgressReport {
    const latest = this.validationHistory[this.validationHistory.length - 1];
    const initial = this.validationHistory[0];

    if (!latest || !initial) {
      throw new Error('Insufficient validation history for progress report');
    }

    const progress: ProgressReport = {
      startTime: initial.timestamp,
      currentTime: latest.timestamp,
      currentPhase: latest.phase,
      overallProgress: this.calculateOverallProgress(),
      phaseProgress: this.calculatePhaseProgress(latest.phase),
      metrics: {
        errorReduction: this.calculateErrorReduction(),
        buildSuccessRate: this.calculateBuildSuccessRate(),
        testPassRate: this.calculateTestPassRate(),
        performanceImprovement: this.calculatePerformanceImprovement(),
      },
      nextSteps: this.generateNextSteps(latest),
      estimatedCompletion: this.estimateCompletion(),
    };

    return progress;
  }
}
```

### Rollback and Recovery Patterns

#### Automated Rollback System

```typescript
class RollbackManager {
  private rollbackPoints: Map<string, RollbackPoint> = new Map();

  async createRollbackPoint(
    identifier: string,
    description: string,
    projectRoot: string
  ): Promise<RollbackPoint> {
    const rollbackPoint: RollbackPoint = {
      id: identifier,
      description,
      timestamp: new Date(),
      gitCommit: await this.getCurrentGitCommit(projectRoot),
      fileSnapshots: await this.createFileSnapshots(projectRoot),
      configurationState: await this.captureConfigurationState(projectRoot),
      dependencyState: await this.captureDependencyState(projectRoot),
    };

    this.rollbackPoints.set(identifier, rollbackPoint);

    // Persist rollback point
    await this.persistRollbackPoint(rollbackPoint);

    return rollbackPoint;
  }

  async rollbackToPoint(identifier: string, projectRoot: string): Promise<RollbackResult> {
    const rollbackPoint = this.rollbackPoints.get(identifier);

    if (!rollbackPoint) {
      throw new Error(`Rollback point not found: ${identifier}`);
    }

    try {
      console.log(`🔄 Rolling back to: ${rollbackPoint.description}`);

      // 1. Git rollback
      if (rollbackPoint.gitCommit) {
        await this.gitRollback(rollbackPoint.gitCommit, projectRoot);
      }

      // 2. Restore file snapshots
      await this.restoreFileSnapshots(rollbackPoint.fileSnapshots, projectRoot);

      // 3. Restore configuration state
      await this.restoreConfigurationState(rollbackPoint.configurationState, projectRoot);

      // 4. Restore dependency state
      await this.restoreDependencyState(rollbackPoint.dependencyState, projectRoot);

      // 5. Validate rollback success
      const validation = await this.validateRollback(rollbackPoint, projectRoot);

      return {
        success: validation.success,
        rollbackPoint,
        validationResult: validation,
        message: validation.success
          ? `Successfully rolled back to ${rollbackPoint.description}`
          : `Rollback completed but validation failed`,
      };
    } catch (error) {
      return {
        success: false,
        rollbackPoint,
        error: error.message,
        message: `Rollback failed: ${error.message}`,
      };
    }
  }
}
```

This systematic codebase repair framework provides comprehensive patterns for transforming a broken codebase into a fully functional system through structured, validated, and recoverable repair processes.
