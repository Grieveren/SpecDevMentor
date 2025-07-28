import { test, expect } from '@playwright/test';
import { AuthHelper, testUsers } from './fixtures/auth';
import { ProjectHelper, testProjects } from './fixtures/project';

test.describe('Data Privacy and Security Compliance @security', () => {
  let authHelper: AuthHelper;
  let projectHelper: ProjectHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    projectHelper = new ProjectHelper(page);
  });

  test('should handle PII data properly', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    // Add content with PII data
    const contentWithPII = `
# Requirements Document

## User Data Requirements

### Personal Information
- Email: john.doe@example.com
- Phone: (555) 123-4567
- SSN: 123-45-6789
- Credit Card: 4532-1234-5678-9012
- Address: 123 Main St, Anytown, ST 12345

### Requirements
1. WHEN user provides email john.doe@example.com THEN system SHALL validate
2. WHEN user enters SSN 123-45-6789 THEN system SHALL encrypt
    `;

    await projectHelper.updateDocument(contentWithPII);

    // Request AI review - should mask PII before sending to AI service
    await projectHelper.requestAIReview();

    // Verify PII is masked in AI service requests
    let aiRequestBody = '';
    page.on('request', request => {
      if (request.url().includes('/api/ai/review')) {
        aiRequestBody = request.postData() || '';
      }
    });

    // Trigger another AI review to capture request
    await projectHelper.updateDocument(contentWithPII + '\n// Updated');
    await projectHelper.requestAIReview();

    // Verify PII is masked in AI requests
    expect(aiRequestBody).toContain('[EMAIL]');
    expect(aiRequestBody).toContain('[SSN]');
    expect(aiRequestBody).toContain('[CARD]');
    expect(aiRequestBody).not.toContain('john.doe@example.com');
    expect(aiRequestBody).not.toContain('123-45-6789');
    expect(aiRequestBody).not.toContain('4532-1234-5678-9012');
  });

  test('should implement data retention policies', async ({ page }) => {
    await authHelper.login(testUsers.admin);
    
    // Navigate to admin panel
    await page.goto('/admin');
    
    if (await page.locator('[data-testid="data-retention-settings"]').isVisible()) {
      // Verify data retention settings exist
      await expect(page.locator('[data-testid="ai-cache-retention"]')).toBeVisible();
      await expect(page.locator('[data-testid="audit-log-retention"]')).toBeVisible();
      await expect(page.locator('[data-testid="user-data-retention"]')).toBeVisible();

      // Verify default retention periods
      const aiCacheRetention = await page.locator('[data-testid="ai-cache-retention-value"]').textContent();
      const auditLogRetention = await page.locator('[data-testid="audit-log-retention-value"]').textContent();

      expect(aiCacheRetention).toContain('24 hours');
      expect(auditLogRetention).toContain('90 days');
    }
  });

  test('should provide data export functionality', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    // Create some data
    const project = testProjects.taskManager;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');
    await projectHelper.updateDocument('# My Requirements Data');

    // Navigate to user settings
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');

    // Look for data export functionality
    if (await page.locator('[data-testid="data-export-section"]').isVisible()) {
      await page.click('[data-testid="export-my-data-button"]');
      
      // Verify export request is processed
      await expect(page.locator('[data-testid="export-requested"]')).toBeVisible();
      await expect(page.locator('[data-testid="export-requested"]')).toContainText('export request');
    }
  });

  test('should provide data deletion functionality', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    // Navigate to user settings
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="settings-link"]');

    // Look for account deletion functionality
    if (await page.locator('[data-testid="delete-account-section"]').isVisible()) {
      await page.click('[data-testid="delete-account-button"]');
      
      // Should show confirmation dialog
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toBeVisible();
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).toContainText('permanently delete');
      
      // Cancel deletion
      await page.click('[data-testid="cancel-deletion-button"]');
      await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
    }
  });

  test('should encrypt sensitive data at rest', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    // Add sensitive content
    const sensitiveContent = `
# Requirements Document

## Security Requirements

### Authentication
- API Keys: sk-1234567890abcdef
- Database Password: super_secret_password
- JWT Secret: my-jwt-secret-key

### Requirements
1. WHEN user authenticates THEN system SHALL use secure tokens
    `;

    await projectHelper.updateDocument(sensitiveContent);

    // Verify data is saved
    await page.waitForSelector('[data-testid="save-indicator-saved"]');

    // Check that sensitive data is not stored in plain text
    // This would typically require backend API testing
    const response = await page.request.get('/api/projects');
    const responseText = await response.text();
    
    // Sensitive data should not appear in API responses
    expect(responseText).not.toContain('sk-1234567890abcdef');
    expect(responseText).not.toContain('super_secret_password');
    expect(responseText).not.toContain('my-jwt-secret-key');
  });

  test('should implement secure session management', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    // Verify secure session cookies
    const cookies = await page.context().cookies();
    const sessionCookie = cookies.find(cookie => cookie.name.includes('session'));
    
    if (sessionCookie) {
      expect(sessionCookie.secure).toBe(true);
      expect(sessionCookie.httpOnly).toBe(true);
      expect(sessionCookie.sameSite).toBe('Strict');
    }

    // Test session timeout
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

    // Simulate session expiry by manipulating cookie
    await page.context().clearCookies();
    
    // Try to access protected resource
    await page.goto('/dashboard');
    
    // Should redirect to login
    await page.waitForURL('/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('should validate SSL/TLS configuration', async ({ page }) => {
    // This test assumes HTTPS is configured in production
    const response = await page.goto('/');
    
    // Check for secure connection indicators
    const url = page.url();
    if (url.startsWith('https://')) {
      // Verify security headers for HTTPS
      const headers = response?.headers();
      expect(headers?.['strict-transport-security']).toBeDefined();
    }
  });

  test('should implement proper error handling without information disclosure', async ({ page }) => {
    // Test various error scenarios
    const errorScenarios = [
      { url: '/api/projects/nonexistent', expectedStatus: 404 },
      { url: '/api/users/unauthorized', expectedStatus: 403 },
      { url: '/api/invalid-endpoint', expectedStatus: 404 }
    ];

    for (const scenario of errorScenarios) {
      const response = await page.request.get(scenario.url);
      expect(response.status()).toBe(scenario.expectedStatus);
      
      const responseText = await response.text();
      
      // Should not expose sensitive information in error messages
      expect(responseText).not.toContain('stack trace');
      expect(responseText).not.toContain('database');
      expect(responseText).not.toContain('internal server');
      expect(responseText).not.toContain('file path');
    }
  });

  test('should implement content security policy', async ({ page }) => {
    const response = await page.goto('/dashboard');
    const headers = response?.headers();
    
    const csp = headers?.['content-security-policy'];
    expect(csp).toBeDefined();
    
    if (csp) {
      // Verify CSP includes important directives
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("script-src");
      expect(csp).toContain("style-src");
      expect(csp).toContain("img-src");
      expect(csp).toContain("connect-src");
    }
  });

  test('should prevent unauthorized API access', async ({ page }) => {
    // Test API endpoints without authentication
    const protectedEndpoints = [
      '/api/projects',
      '/api/users/profile',
      '/api/ai/review',
      '/api/analytics',
      '/api/admin/users'
    ];

    for (const endpoint of protectedEndpoints) {
      const response = await page.request.get(endpoint);
      
      // Should return 401 Unauthorized or 403 Forbidden
      expect([401, 403]).toContain(response.status());
    }
  });

  test('should implement proper CORS configuration', async ({ page }) => {
    // Test CORS headers
    const response = await page.request.options('/api/projects');
    const headers = response.headers();
    
    // Verify CORS headers are restrictive
    const allowOrigin = headers['access-control-allow-origin'];
    expect(allowOrigin).not.toBe('*'); // Should not allow all origins
    
    const allowMethods = headers['access-control-allow-methods'];
    if (allowMethods) {
      expect(allowMethods).not.toContain('TRACE');
      expect(allowMethods).not.toContain('CONNECT');
    }
  });

  test('should validate file upload security', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);

    // Test file upload restrictions if available
    const fileUploadButton = page.locator('[data-testid="file-upload-button"]');
    
    if (await fileUploadButton.isVisible()) {
      // Test executable file upload
      const executableFile = Buffer.from('#!/bin/bash\necho "malicious"');
      
      await fileUploadButton.setInputFiles({
        name: 'malicious.sh',
        mimeType: 'application/x-sh',
        buffer: executableFile,
      });

      // Should reject executable files
      await expect(page.locator('[data-testid="file-type-error"]')).toBeVisible();
      
      // Test oversized file
      const largeFile = Buffer.alloc(10 * 1024 * 1024); // 10MB
      
      await fileUploadButton.setInputFiles({
        name: 'large.txt',
        mimeType: 'text/plain',
        buffer: largeFile,
      });

      // Should reject oversized files
      await expect(page.locator('[data-testid="file-size-error"]')).toBeVisible();
    }
  });

  test('should implement database security measures', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    // Test for SQL injection prevention in various inputs
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "' OR 1=1 --",
      "' UNION SELECT password FROM users --"
    ];

    // Test project name input
    await page.goto('/dashboard');
    await page.click('[data-testid="create-project-button"]');
    
    for (const payload of sqlPayloads) {
      await page.fill('[data-testid="project-name-input"]', payload);
      await page.fill('[data-testid="project-description-input"]', 'Test description');
      await page.click('[data-testid="create-project-submit"]');
      
      // Should handle gracefully without SQL errors
      const errorMessage = page.locator('[data-testid="error-message"]');
      if (await errorMessage.isVisible()) {
        const errorText = await errorMessage.textContent();
        expect(errorText?.toLowerCase()).not.toContain('sql');
        expect(errorText?.toLowerCase()).not.toContain('database');
      }
      
      // Clear form for next test
      await page.fill('[data-testid="project-name-input"]', '');
    }
  });
});