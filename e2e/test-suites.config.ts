import { defineConfig } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';
import baseConfig from '../playwright.config';

// Configuration for different test suites
export const testSuites: Record<string, PlaywrightTestConfig> = {
  // Full end-to-end workflow tests
  e2e: {
    ...baseConfig,
    testDir: './e2e',
    testMatch: [
      'specification-workflow.spec.ts',
      'collaboration.spec.ts',
      'ai-integration.spec.ts'
    ],
    reporter: [
      ['html', { outputFolder: 'test-results/e2e-report' }],
      ['json', { outputFile: 'test-results/e2e-results.json' }]
    ]
  },

  // Performance and load tests
  performance: {
    ...baseConfig,
    testDir: './e2e',
    testMatch: ['performance.spec.ts'],
    workers: 1, // Run performance tests sequentially
    timeout: 120000, // 2 minutes for performance tests
    reporter: [
      ['html', { outputFolder: 'test-results/performance-report' }],
      ['json', { outputFile: 'test-results/performance-results.json' }]
    ]
  },

  // Accessibility tests
  accessibility: {
    ...baseConfig,
    testDir: './e2e',
    testMatch: ['accessibility.spec.ts'],
    reporter: [
      ['html', { outputFolder: 'test-results/accessibility-report' }],
      ['json', { outputFile: 'test-results/accessibility-results.json' }]
    ]
  },

  // Security and compliance tests
  security: {
    ...baseConfig,
    testDir: './e2e',
    testMatch: ['security.spec.ts', 'compliance.spec.ts'],
    reporter: [
      ['html', { outputFolder: 'test-results/security-report' }],
      ['json', { outputFile: 'test-results/security-results.json' }]
    ]
  },

  // Smoke tests for quick validation
  smoke: {
    ...baseConfig,
    testDir: './e2e',
    testMatch: ['**/smoke.spec.ts'],
    workers: 2,
    timeout: 30000,
    reporter: [
      ['line'],
      ['json', { outputFile: 'test-results/smoke-results.json' }]
    ]
  }
};

export default baseConfig;