# Build Validation Patterns

## Build Artifact Validation Framework

### Core Validation Interface

```typescript
interface BuildArtifactValidator {
  validateClientBuild(distPath: string): ValidationResult;
  validateServerBuild(distPath: string): ValidationResult;
  validateAssetOptimization(assets: BuildArtifact[]): ValidationResult;
  validateBuildIntegrity(buildOutput: BuildOutput): ValidationResult;
}

interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metrics: BuildMetrics;
  suggestions: string[];
}

interface BuildArtifact {
  path: string;
  size: number;
  hash: string;
  type: 'js' | 'css' | 'html' | 'map' | 'assets' | 'other';
  compressed: boolean;
  minified: boolean;
}

interface BuildMetrics {
  totalSize: number;
  compressedSize: number;
  compressionRatio: number;
  buildTime: number;
  chunkCount: number;
  assetCount: number;
}
```

## Client Build Validation

### Vite Build Validation

```typescript
class ViteClientValidator implements BuildArtifactValidator {
  async validateClientBuild(distPath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const metrics: BuildMetrics = await this.collectMetrics(distPath);

    // 1. Check required files exist
    const requiredFiles = ['index.html', 'assets/index.js', 'assets/index.css'];
    for (const file of requiredFiles) {
      const filePath = path.join(distPath, file);
      if (!fs.existsSync(filePath)) {
        errors.push({
          type: 'missing_file',
          message: `Required file missing: ${file}`,
          severity: 'error',
        });
      }
    }

    // 2. Validate HTML structure
    const indexHtml = path.join(distPath, 'index.html');
    if (fs.existsSync(indexHtml)) {
      const htmlContent = fs.readFileSync(indexHtml, 'utf-8');

      // Check for proper asset references
      if (!htmlContent.includes('<script') || !htmlContent.includes('<link')) {
        errors.push({
          type: 'invalid_html',
          message: 'index.html missing script or stylesheet references',
          severity: 'error',
        });
      }

      // Check for proper meta tags
      if (!htmlContent.includes('<meta charset="utf-8">')) {
        warnings.push({
          type: 'missing_meta',
          message: 'Missing charset meta tag',
          severity: 'warning',
        });
      }
    }

    // 3. Validate JavaScript bundles
    const jsFiles = await this.findFiles(distPath, /\.js$/);
    for (const jsFile of jsFiles) {
      const validation = await this.validateJavaScriptFile(jsFile);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    }

    // 4. Validate CSS bundles
    const cssFiles = await this.findFiles(distPath, /\.css$/);
    for (const cssFile of cssFiles) {
      const validation = await this.validateCSSFile(cssFile);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    }

    // 5. Check bundle sizes
    if (metrics.totalSize > 5 * 1024 * 1024) {
      // 5MB threshold
      warnings.push({
        type: 'large_bundle',
        message: `Total bundle size (${this.formatSize(
          metrics.totalSize
        )}) exceeds recommended 5MB`,
        severity: 'warning',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics,
      suggestions: this.generateSuggestions(errors, warnings, metrics),
    };
  }

  private async validateJavaScriptFile(filePath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for syntax errors (basic validation)
      if (content.includes('Uncaught') || content.includes('SyntaxError')) {
        errors.push({
          type: 'js_syntax_error',
          message: `Potential syntax error in ${path.basename(filePath)}`,
          severity: 'error',
        });
      }

      // Check for source maps
      if (!content.includes('//# sourceMappingURL=') && !fs.existsSync(filePath + '.map')) {
        warnings.push({
          type: 'missing_sourcemap',
          message: `Missing source map for ${path.basename(filePath)}`,
          severity: 'warning',
        });
      }

      // Check minification
      const isMinified = content.length > 1000 && !content.includes('\n  '); // Simple heuristic
      if (!isMinified) {
        warnings.push({
          type: 'not_minified',
          message: `File ${path.basename(filePath)} appears not to be minified`,
          severity: 'warning',
        });
      }
    } catch (error) {
      errors.push({
        type: 'file_read_error',
        message: `Cannot read JavaScript file: ${filePath}`,
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics: {} as BuildMetrics,
      suggestions: [],
    };
  }
}
```

## Server Build Validation

### Node.js Server Build Validation

```typescript
class NodeServerValidator implements BuildArtifactValidator {
  async validateServerBuild(distPath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const metrics: BuildMetrics = await this.collectMetrics(distPath);

    // 1. Check main entry point exists
    const packageJsonPath = path.join(distPath, '../package.json');
    let mainFile = 'index.js';

    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      mainFile = packageJson.main || 'index.js';
    }

    const mainFilePath = path.join(distPath, mainFile);
    if (!fs.existsSync(mainFilePath)) {
      errors.push({
        type: 'missing_entry_point',
        message: `Main entry point missing: ${mainFile}`,
        severity: 'error',
      });
    }

    // 2. Validate TypeScript compilation output
    const jsFiles = await this.findFiles(distPath, /\.js$/);
    for (const jsFile of jsFiles) {
      const validation = await this.validateServerJavaScript(jsFile);
      errors.push(...validation.errors);
      warnings.push(...validation.warnings);
    }

    // 3. Check for required dependencies
    const requiredModules = ['express', 'cors', 'helmet']; // Common server dependencies
    for (const jsFile of jsFiles) {
      const content = fs.readFileSync(jsFile, 'utf-8');
      for (const module of requiredModules) {
        if (content.includes(`require("${module}")`) || content.includes(`from "${module}"`)) {
          // Module is used, check if it's available
          const moduleCheck = await this.checkModuleAvailability(module, distPath);
          if (!moduleCheck.available) {
            errors.push({
              type: 'missing_dependency',
              message: `Required module ${module} not found`,
              severity: 'error',
            });
          }
        }
      }
    }

    // 4. Validate environment variable usage
    const envValidation = await this.validateEnvironmentVariables(distPath);
    errors.push(...envValidation.errors);
    warnings.push(...envValidation.warnings);

    // 5. Check for proper error handling
    const errorHandlingValidation = await this.validateErrorHandling(distPath);
    warnings.push(...errorHandlingValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics,
      suggestions: this.generateSuggestions(errors, warnings, metrics),
    };
  }

  private async validateServerJavaScript(filePath: string): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for TypeScript compilation artifacts
      if (content.includes('__awaiter') || content.includes('__generator')) {
        // This indicates TypeScript compilation output - good sign
      }

      // Check for proper module exports
      if (
        !content.includes('module.exports') &&
        !content.includes('exports.') &&
        !content.includes('export ')
      ) {
        warnings.push({
          type: 'no_exports',
          message: `File ${path.basename(filePath)} has no exports`,
          severity: 'warning',
        });
      }

      // Check for console.log statements (should be removed in production)
      const consoleMatches = content.match(/console\.log/g);
      if (consoleMatches && consoleMatches.length > 0) {
        warnings.push({
          type: 'console_statements',
          message: `Found ${consoleMatches.length} console.log statements in ${path.basename(
            filePath
          )}`,
          severity: 'warning',
        });
      }
    } catch (error) {
      errors.push({
        type: 'file_read_error',
        message: `Cannot read server file: ${filePath}`,
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics: {} as BuildMetrics,
      suggestions: [],
    };
  }
}
```

## Asset Optimization Validation

### Comprehensive Asset Validation

```typescript
class AssetOptimizationValidator {
  async validateAssetOptimization(assets: BuildArtifact[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const metrics = this.calculateAssetMetrics(assets);

    // 1. Check compression ratios
    for (const asset of assets) {
      if (asset.type === 'js' || asset.type === 'css') {
        const compressionRatio = this.calculateCompressionRatio(asset);

        if (compressionRatio < 0.3) {
          // Less than 30% compression
          warnings.push({
            type: 'poor_compression',
            message: `Poor compression ratio (${(compressionRatio * 100).toFixed(1)}%) for ${
              asset.path
            }`,
            severity: 'warning',
          });
        }
      }
    }

    // 2. Check for oversized assets
    const oversizedAssets = assets.filter(asset => asset.size > 1024 * 1024); // 1MB
    for (const asset of oversizedAssets) {
      warnings.push({
        type: 'oversized_asset',
        message: `Large asset detected: ${asset.path} (${this.formatSize(asset.size)})`,
        severity: 'warning',
      });
    }

    // 3. Validate image optimization
    const imageAssets = assets.filter(asset => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(asset.path));
    for (const image of imageAssets) {
      const validation = await this.validateImageOptimization(image);
      warnings.push(...validation.warnings);
    }

    // 4. Check for duplicate assets
    const duplicates = this.findDuplicateAssets(assets);
    for (const duplicate of duplicates) {
      warnings.push({
        type: 'duplicate_asset',
        message: `Duplicate asset detected: ${duplicate.paths.join(', ')}`,
        severity: 'warning',
      });
    }

    // 5. Validate chunk splitting
    const jsAssets = assets.filter(asset => asset.type === 'js');
    if (jsAssets.length === 1 && jsAssets[0].size > 500 * 1024) {
      // 500KB
      warnings.push({
        type: 'no_code_splitting',
        message: 'Large single JavaScript bundle detected. Consider code splitting.',
        severity: 'warning',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics,
      suggestions: this.generateOptimizationSuggestions(warnings, metrics),
    };
  }

  private generateOptimizationSuggestions(
    warnings: ValidationWarning[],
    metrics: BuildMetrics
  ): string[] {
    const suggestions: string[] = [];

    if (warnings.some(w => w.type === 'poor_compression')) {
      suggestions.push('Enable gzip/brotli compression in your web server configuration');
      suggestions.push(
        'Consider using webpack-bundle-analyzer to identify compression opportunities'
      );
    }

    if (warnings.some(w => w.type === 'oversized_asset')) {
      suggestions.push('Implement lazy loading for large assets');
      suggestions.push('Consider splitting large bundles into smaller chunks');
    }

    if (warnings.some(w => w.type === 'no_code_splitting')) {
      suggestions.push('Implement dynamic imports for route-based code splitting');
      suggestions.push('Use React.lazy() for component-level code splitting');
    }

    if (metrics.totalSize > 2 * 1024 * 1024) {
      // 2MB
      suggestions.push('Consider implementing a performance budget');
      suggestions.push('Audit and remove unused dependencies');
    }

    return suggestions;
  }
}
```

## Build Integrity Validation

### End-to-End Build Validation

```typescript
class BuildIntegrityValidator {
  async validateBuildIntegrity(buildOutput: BuildOutput): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // 1. Cross-reference client and server builds
    const clientServerCompatibility = await this.validateClientServerCompatibility(
      buildOutput.clientDist,
      buildOutput.serverDist
    );
    errors.push(...clientServerCompatibility.errors);
    warnings.push(...clientServerCompatibility.warnings);

    // 2. Validate API endpoint consistency
    const apiValidation = await this.validateAPIConsistency(buildOutput);
    errors.push(...apiValidation.errors);
    warnings.push(...apiValidation.warnings);

    // 3. Check for build reproducibility
    const reproducibilityCheck = await this.validateBuildReproducibility(buildOutput);
    warnings.push(...reproducibilityCheck.warnings);

    // 4. Validate security headers and configurations
    const securityValidation = await this.validateSecurityConfiguration(buildOutput);
    errors.push(...securityValidation.errors);
    warnings.push(...securityValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics: buildOutput.metrics,
      suggestions: this.generateIntegritySuggestions(errors, warnings),
    };
  }

  private async validateClientServerCompatibility(
    clientDist: string,
    serverDist: string
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check API endpoint definitions match
    const clientApiCalls = await this.extractApiCalls(clientDist);
    const serverApiRoutes = await this.extractApiRoutes(serverDist);

    for (const apiCall of clientApiCalls) {
      const matchingRoute = serverApiRoutes.find(
        route => route.path === apiCall.path && route.method === apiCall.method
      );

      if (!matchingRoute) {
        errors.push({
          type: 'api_mismatch',
          message: `Client calls ${apiCall.method} ${apiCall.path} but server route not found`,
          severity: 'error',
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics: {} as BuildMetrics,
      suggestions: [],
    };
  }
}
```

## Validation Script Integration

### Automated Build Validation Script

```bash
#!/bin/bash
# build-validation.sh - Comprehensive build validation script

set -e

echo "🔍 Starting comprehensive build validation..."

# Configuration
CLIENT_DIST="client/dist"
SERVER_DIST="server/dist"
VALIDATION_REPORT="build-validation-report.json"

# Function to run validation with timeout
validate_with_timeout() {
    local validation_type="$1"
    local timeout_sec="$2"

    echo "⏱️  Running $validation_type validation (timeout: ${timeout_sec}s)..."

    if timeout $timeout_sec npm run validate:$validation_type; then
        echo "✅ $validation_type validation passed"
        return 0
    else
        echo "❌ $validation_type validation failed or timed out"
        return 1
    fi
}

# 1. Validate client build
if [ -d "$CLIENT_DIST" ]; then
    validate_with_timeout "client" 60
else
    echo "❌ Client dist directory not found: $CLIENT_DIST"
    exit 1
fi

# 2. Validate server build
if [ -d "$SERVER_DIST" ]; then
    validate_with_timeout "server" 60
else
    echo "❌ Server dist directory not found: $SERVER_DIST"
    exit 1
fi

# 3. Validate asset optimization
validate_with_timeout "assets" 30

# 4. Validate build integrity
validate_with_timeout "integrity" 45

# 5. Generate comprehensive report
echo "📊 Generating validation report..."
npm run validate:report > "$VALIDATION_REPORT"

# 6. Check validation results
if [ -f "$VALIDATION_REPORT" ]; then
    ERRORS=$(jq '.errors | length' "$VALIDATION_REPORT")
    WARNINGS=$(jq '.warnings | length' "$VALIDATION_REPORT")

    echo "📋 Validation Summary:"
    echo "   Errors: $ERRORS"
    echo "   Warnings: $WARNINGS"

    if [ "$ERRORS" -eq 0 ]; then
        echo "🎉 Build validation completed successfully!"
        exit 0
    else
        echo "💥 Build validation failed with $ERRORS errors"
        echo "📄 Check $VALIDATION_REPORT for details"
        exit 1
    fi
else
    echo "❌ Failed to generate validation report"
    exit 1
fi
```

## Package.json Integration

### Required Scripts for Build Validation

```json
{
  "scripts": {
    "validate:client": "node scripts/validate-client-build.js",
    "validate:server": "node scripts/validate-server-build.js",
    "validate:assets": "node scripts/validate-asset-optimization.js",
    "validate:integrity": "node scripts/validate-build-integrity.js",
    "validate:report": "node scripts/generate-validation-report.js",
    "validate:all": "./scripts/build-validation.sh",
    "build:validate": "npm run build && npm run validate:all"
  }
}
```

## Usage Patterns

### Integration with CI/CD

```yaml
# .github/workflows/build-validation.yml
name: Build Validation

on: [push, pull_request]

jobs:
  validate-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci --timeout=30000

      - name: Build application
        run: timeout 300s npm run build

      - name: Validate build artifacts
        run: npm run validate:all

      - name: Upload validation report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: build-validation-report
          path: build-validation-report.json
```

This comprehensive build validation framework provides the systematic validation patterns needed to support your codebase-systematic-fix spec, ensuring that each build phase produces valid, optimized, and production-ready artifacts.
