import type { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('🧹 Running global teardown for E2E tests...');
  
  // Clean up any global resources if needed
  // For example, clearing test databases, stopping services, etc.
  
  try {
    // Add any cleanup logic here
    // await cleanupTestDatabase();
    // await stopTestServices();
    
    console.log('✅ Global teardown completed');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
    // Don't throw here to avoid masking test failures
  }
}

export default globalTeardown;