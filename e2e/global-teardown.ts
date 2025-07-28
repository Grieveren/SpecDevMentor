import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Running global teardown for E2E tests...');
  
  // Clean up any global resources if needed
  // For example, clearing test databases, stopping services, etc.
  
  console.log('✅ Global teardown completed');
}

export default globalTeardown;