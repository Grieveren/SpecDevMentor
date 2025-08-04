# Project Architecture & Standards

## Project Overview

CodeMentor AI is a comprehensive AI-powered coding mentor platform built with:

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + TypeScript (server workspace)
- **Monorepo**: pnpm workspaces with client/server separation
- **Testing**: Jest with React Testing Library
- **Code Quality**: ESLint + Prettier + Husky pre-commit hooks

## Directory Structure

```
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── services/       # API clients and external services
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions and helpers
│   │   └── __tests__/      # Component and integration tests
├── server/                 # Node.js backend application
├── packages/               # Shared packages and utilities
└── docs/                   # Project documentation
```

## Component Architecture Standards

### Component Structure

- Use functional components with TypeScript
- Export interfaces for all component props
- Use React.FC type annotation for components
- Implement proper prop destructuring with defaults

### File Naming Conventions

- Components: PascalCase (e.g., `SpecificationLayout.tsx`)
- Utilities: camelCase (e.g., `apiClient.ts`)
- Types: PascalCase interfaces (e.g., `SpecificationProject`)
- Test files: `*.test.ts` or `*.test.tsx`

### Import Organization

1. React and external libraries
2. Internal components and utilities
3. Type imports
4. Relative imports

## TypeScript Standards

- Use strict mode configuration
- Prefer interfaces over types for object shapes
- Use proper generic constraints
- Avoid `any` type - use `unknown` or proper typing
- Use optional chaining and nullish coalescing operators

## TypeScript Error Resolution Patterns

### Error Classification System

```typescript
enum ErrorCategory {
  MISSING_DECLARATIONS = 'missing_declarations',
  TYPE_MISMATCHES = 'type_mismatches',
  IMPORT_ISSUES = 'import_issues',
  INTERFACE_VIOLATIONS = 'interface_violations',
  GENERIC_CONSTRAINTS = 'generic_constraints',
  MODULE_RESOLUTION = 'module_resolution',
  REACT_PROP_TYPES = 'react_prop_types',
  EXPRESS_TYPES = 'express_types',
  PRISMA_TYPES = 'prisma_types',
}

interface ErrorResolutionStrategy {
  category: ErrorCategory;
  pattern: RegExp;
  autoFixable: boolean;
  resolutionSteps: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedEffort: number; // minutes
}
```

### Common Error Patterns and Resolutions

#### 1. Missing Type Declarations

```typescript
// Error Pattern: Cannot find name 'X' or has no exported member 'X'
const MISSING_DECLARATIONS_PATTERNS: ErrorResolutionStrategy[] = [
  {
    category: ErrorCategory.MISSING_DECLARATIONS,
    pattern: /Cannot find name '(\w+)'/,
    autoFixable: true,
    resolutionSteps: [
      'Check if variable is declared in scope',
      'Add import statement if from external module',
      'Add type declaration if custom type',
      'Check spelling and case sensitivity',
    ],
    priority: 'high',
    estimatedEffort: 5,
  },
  {
    category: ErrorCategory.MISSING_DECLARATIONS,
    pattern: /Module '".*"' has no exported member '(\w+)'/,
    autoFixable: true,
    resolutionSteps: [
      'Verify export exists in target module',
      'Check for typos in import name',
      'Use default import if not named export',
      'Update import to match actual exports',
    ],
    priority: 'high',
    estimatedEffort: 3,
  },
];
```

#### 2. React Component Type Issues

```typescript
// Error Pattern: React component prop type mismatches
const REACT_PROP_PATTERNS: ErrorResolutionStrategy[] = [
  {
    category: ErrorCategory.REACT_PROP_TYPES,
    pattern: /Type '.*' is not assignable to type 'IntrinsicAttributes'/,
    autoFixable: true,
    resolutionSteps: [
      'Define proper interface for component props',
      'Ensure all required props are provided',
      'Check for typos in prop names',
      'Add optional modifiers where appropriate',
    ],
    priority: 'medium',
    estimatedEffort: 10,
  },
  {
    category: ErrorCategory.REACT_PROP_TYPES,
    pattern: /Property '(\w+)' does not exist on type 'PropsWithChildren'/,
    autoFixable: true,
    resolutionSteps: [
      'Extend component props interface',
      'Add missing prop to interface definition',
      'Check if prop should be optional',
      'Verify prop is being passed correctly',
    ],
    priority: 'medium',
    estimatedEffort: 5,
  },
];
```

#### 3. Express.js Type Issues

```typescript
// Error Pattern: Express request/response type issues
const EXPRESS_TYPE_PATTERNS: ErrorResolutionStrategy[] = [
  {
    category: ErrorCategory.EXPRESS_TYPES,
    pattern: /Property '(\w+)' does not exist on type 'Request'/,
    autoFixable: true,
    resolutionSteps: [
      'Import proper Express types (@types/express)',
      'Extend Request interface if custom properties',
      'Use req.body, req.params, req.query correctly',
      'Add type assertions where necessary',
    ],
    priority: 'high',
    estimatedEffort: 8,
  },
  {
    category: ErrorCategory.EXPRESS_TYPES,
    pattern: /Argument of type '.*' is not assignable to parameter of type 'RequestHandler'/,
    autoFixable: true,
    resolutionSteps: [
      'Ensure middleware function signature matches RequestHandler',
      'Add proper typing for req, res, next parameters',
      'Check return type (void or Promise<void>)',
      'Import RequestHandler type from express',
    ],
    priority: 'high',
    estimatedEffort: 10,
  },
];
```

#### 4. Prisma Database Type Issues

```typescript
// Error Pattern: Prisma client type mismatches
const PRISMA_TYPE_PATTERNS: ErrorResolutionStrategy[] = [
  {
    category: ErrorCategory.PRISMA_TYPES,
    pattern: /Property '(\w+)' does not exist on type 'PrismaClient'/,
    autoFixable: true,
    resolutionSteps: [
      'Regenerate Prisma client: npx prisma generate',
      'Check if model exists in schema.prisma',
      'Verify Prisma client is properly imported',
      'Check for typos in model/field names',
    ],
    priority: 'critical',
    estimatedEffort: 15,
  },
  {
    category: ErrorCategory.PRISMA_TYPES,
    pattern: /Type '.*' is not assignable to type '.*WhereInput'/,
    autoFixable: true,
    resolutionSteps: [
      'Check Prisma schema field types',
      'Use proper filter operators (equals, contains, etc.)',
      'Ensure field names match schema exactly',
      'Add proper type annotations for query parameters',
    ],
    priority: 'high',
    estimatedEffort: 12,
  },
];
```

#### 5. Module Resolution Issues

```typescript
// Error Pattern: Cannot resolve module or import issues
const MODULE_RESOLUTION_PATTERNS: ErrorResolutionStrategy[] = [
  {
    category: ErrorCategory.MODULE_RESOLUTION,
    pattern: /Cannot find module '(.*)' or its corresponding type declarations/,
    autoFixable: false,
    resolutionSteps: [
      'Install missing package: npm install <package>',
      'Install type definitions: npm install @types/<package>',
      'Check if path mapping is configured correctly',
      'Verify file exists at specified path',
    ],
    priority: 'critical',
    estimatedEffort: 20,
  },
  {
    category: ErrorCategory.MODULE_RESOLUTION,
    pattern: /Module '".*"' resolves to an untyped module/,
    autoFixable: true,
    resolutionSteps: [
      'Install @types package for the module',
      'Create custom type declaration file',
      'Add module to skipLibCheck if necessary',
      'Use module augmentation if needed',
    ],
    priority: 'medium',
    estimatedEffort: 15,
  },
];
```

### Automated Error Resolution Scripts

#### Error Detection and Categorization

```typescript
class TypeScriptErrorAnalyzer {
  private errorPatterns: ErrorResolutionStrategy[] = [
    ...MISSING_DECLARATIONS_PATTERNS,
    ...REACT_PROP_PATTERNS,
    ...EXPRESS_TYPE_PATTERNS,
    ...PRISMA_TYPE_PATTERNS,
    ...MODULE_RESOLUTION_PATTERNS,
  ];

  async analyzeErrors(tscOutput: string): Promise<CategorizedErrors> {
    const errors = this.parseTypeScriptOutput(tscOutput);
    const categorized: CategorizedErrors = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      autoFixable: [],
      manualFix: [],
    };

    for (const error of errors) {
      const strategy = this.findMatchingStrategy(error.message);

      if (strategy) {
        categorized[strategy.priority].push({
          ...error,
          strategy,
        });

        if (strategy.autoFixable) {
          categorized.autoFixable.push({
            ...error,
            strategy,
          });
        } else {
          categorized.manualFix.push({
            ...error,
            strategy,
          });
        }
      }
    }

    return categorized;
  }

  private findMatchingStrategy(errorMessage: string): ErrorResolutionStrategy | null {
    return this.errorPatterns.find(pattern => pattern.pattern.test(errorMessage)) || null;
  }

  generateResolutionPlan(categorized: CategorizedErrors): ResolutionPlan {
    const plan: ResolutionPlan = {
      phases: [],
      totalEstimatedTime: 0,
      autoFixableCount: categorized.autoFixable.length,
      manualFixCount: categorized.manualFix.length,
    };

    // Phase 1: Critical auto-fixable errors
    const criticalAutoFix = categorized.critical.filter(e => e.strategy?.autoFixable);
    if (criticalAutoFix.length > 0) {
      plan.phases.push({
        name: 'Critical Auto-fixes',
        errors: criticalAutoFix,
        estimatedTime: criticalAutoFix.reduce(
          (sum, e) => sum + (e.strategy?.estimatedEffort || 0),
          0
        ),
        automated: true,
      });
    }

    // Phase 2: High priority errors
    const highPriority = categorized.high;
    if (highPriority.length > 0) {
      plan.phases.push({
        name: 'High Priority Fixes',
        errors: highPriority,
        estimatedTime: highPriority.reduce((sum, e) => sum + (e.strategy?.estimatedEffort || 0), 0),
        automated: false,
      });
    }

    // Continue with medium and low priority...

    plan.totalEstimatedTime = plan.phases.reduce((sum, phase) => sum + phase.estimatedTime, 0);

    return plan;
  }
}
```

#### Automated Fix Application

```typescript
class AutomatedErrorFixer {
  async applyAutomatedFixes(errors: CategorizedError[]): Promise<FixResult[]> {
    const results: FixResult[] = [];

    for (const error of errors) {
      if (!error.strategy?.autoFixable) continue;

      try {
        const result = await this.applyFix(error);
        results.push(result);
      } catch (fixError) {
        results.push({
          error,
          success: false,
          message: `Failed to apply fix: ${fixError.message}`,
        });
      }
    }

    return results;
  }

  private async applyFix(error: CategorizedError): Promise<FixResult> {
    switch (error.strategy.category) {
      case ErrorCategory.MISSING_DECLARATIONS:
        return await this.fixMissingDeclaration(error);

      case ErrorCategory.IMPORT_ISSUES:
        return await this.fixImportIssue(error);

      case ErrorCategory.REACT_PROP_TYPES:
        return await this.fixReactPropType(error);

      default:
        throw new Error(`No automated fix available for category: ${error.strategy.category}`);
    }
  }

  private async fixMissingDeclaration(error: CategorizedError): Promise<FixResult> {
    const filePath = error.file;
    const content = await fs.readFile(filePath, 'utf-8');

    // Extract missing identifier from error message
    const match = error.message.match(/Cannot find name '(\w+)'/);
    if (!match) throw new Error('Could not extract identifier from error');

    const identifier = match[1];

    // Check if it's a common global that needs importing
    const commonImports = {
      React: "import React from 'react';",
      useState: "import { useState } from 'react';",
      useEffect: "import { useEffect } from 'react';",
      Express: "import express from 'express';",
      Request: "import { Request } from 'express';",
      Response: "import { Response } from 'express';",
    };

    if (commonImports[identifier]) {
      const updatedContent = this.addImportToFile(content, commonImports[identifier]);
      await fs.writeFile(filePath, updatedContent);

      return {
        error,
        success: true,
        message: `Added import for ${identifier}`,
        changes: [`Added: ${commonImports[identifier]}`],
      };
    }

    throw new Error(`No automated fix available for identifier: ${identifier}`);
  }
}
```

### Error Resolution Workflow

#### Incremental Fix and Validation Process

```bash
#!/bin/bash
# typescript-error-resolution.sh

set -e

echo "🔍 Starting TypeScript error resolution process..."

# Configuration
MAX_ITERATIONS=10
BATCH_SIZE=15
ERROR_LOG="typescript-errors.log"
PROGRESS_LOG="fix-progress.log"

# Function to run TypeScript check and capture errors
check_typescript_errors() {
    echo "📊 Checking TypeScript compilation..."

    if npx tsc --noEmit --listFiles false 2> "$ERROR_LOG"; then
        echo "✅ No TypeScript errors found!"
        return 0
    else
        local error_count=$(grep -c "error TS" "$ERROR_LOG" || echo "0")
        echo "❌ Found $error_count TypeScript errors"
        return 1
    fi
}

# Function to analyze and categorize errors
analyze_errors() {
    echo "🔬 Analyzing and categorizing errors..."

    node scripts/analyze-typescript-errors.js "$ERROR_LOG" > error-analysis.json

    local auto_fixable=$(jq '.autoFixable | length' error-analysis.json)
    local manual_fix=$(jq '.manualFix | length' error-analysis.json)

    echo "   Auto-fixable: $auto_fixable"
    echo "   Manual fix required: $manual_fix"
}

# Function to apply automated fixes
apply_automated_fixes() {
    echo "🔧 Applying automated fixes..."

    if node scripts/apply-automated-fixes.js error-analysis.json; then
        echo "✅ Automated fixes applied successfully"
        return 0
    else
        echo "❌ Some automated fixes failed"
        return 1
    fi
}

# Main resolution loop
iteration=1
while [ $iteration -le $MAX_ITERATIONS ]; do
    echo "🔄 Iteration $iteration/$MAX_ITERATIONS"

    # Check current error state
    if check_typescript_errors; then
        echo "🎉 All TypeScript errors resolved!"
        break
    fi

    # Analyze errors
    analyze_errors

    # Apply automated fixes
    if apply_automated_fixes; then
        echo "✅ Fixes applied, validating..."

        # Quick validation
        if check_typescript_errors; then
            echo "🎉 All errors resolved in iteration $iteration!"
            break
        fi
    else
        echo "⚠️  Automated fixes failed, manual intervention required"
        echo "📄 Check error-analysis.json for manual fix guidance"
        break
    fi

    # Log progress
    echo "Iteration $iteration completed" >> "$PROGRESS_LOG"

    iteration=$((iteration + 1))
done

if [ $iteration -gt $MAX_ITERATIONS ]; then
    echo "⚠️  Maximum iterations reached. Manual fixes may be required."
    echo "📊 Final error analysis available in error-analysis.json"
fi

echo "📋 Error resolution process completed"
```

This enhanced error resolution system provides systematic patterns for identifying, categorizing, and resolving TypeScript compilation errors that are critical to your codebase-systematic-fix spec.

## State Management

- Use React hooks for local state
- Zustand for global state management
- React Hook Form for form state
- Avoid prop drilling - use context or state management

## Styling Standards

- Tailwind CSS for all styling
- Use `cn()` utility for conditional classes
- Implement responsive design mobile-first
- Use Headless UI for complex interactive components
- Heroicons for consistent iconography
