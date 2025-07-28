import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global setup for E2E tests...');

  // Create a browser instance for setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Wait for the application to be ready
    await page.goto('http://localhost:5173');
    await page.waitForSelector('body', { timeout: 30000 });

    // Check if server is responding
    const response = await page.request.get('http://localhost:3001/api/health');
    if (!response.ok()) {
      throw new Error('Server health check failed');
    }

    console.log('✅ Application is ready for testing');
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
}

export default globalSetup;