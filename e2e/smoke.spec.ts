import { test, expect } from '@playwright/test';
import { AuthHelper, testUsers } from './fixtures/auth';
import { ProjectHelper, testProjects } from './fixtures/project';

test.describe('Smoke Tests', () => {
  test('should load application and basic functionality works', async ({ page }) => {
    // Test application loads
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();

    // Test login page loads
    await page.goto('/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();

    // Test registration page loads
    await page.goto('/register');
    await expect(page.locator('[data-testid="register-form"]')).toBeVisible();
  });

  test('should authenticate user successfully', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    
    await authHelper.login(testUsers.developer);
    
    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="dashboard"]')).toBeVisible();
  });

  test('should create and access project', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    const projectHelper = new ProjectHelper(page);
    
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    
    // Verify project appears in dashboard
    await expect(page.locator(`[data-testid="project-card-${project.name}"]`)).toBeVisible();
    
    // Open project
    await projectHelper.openProject(project.name);
    await expect(page.locator('[data-testid="specification-layout"]')).toBeVisible();
  });

  test('should navigate between specification phases', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    const projectHelper = new ProjectHelper(page);
    
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.taskManager;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    
    // Test phase navigation
    await projectHelper.navigateToPhase('REQUIREMENTS');
    await expect(page.locator('[data-testid="requirements-editor"]')).toBeVisible();
    
    await projectHelper.navigateToPhase('DESIGN');
    await expect(page.locator('[data-testid="design-editor"]')).toBeVisible();
    
    await projectHelper.navigateToPhase('TASKS');
    await expect(page.locator('[data-testid="tasks-editor"]')).toBeVisible();
  });

  test('should save document content', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    const projectHelper = new ProjectHelper(page);
    
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.chatApp;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');
    
    // Add content and verify save
    const testContent = '# Test Requirements\n\nThis is a test.';
    await projectHelper.updateDocument(testContent);
    
    // Verify save indicator
    await expect(page.locator('[data-testid="save-indicator-saved"]')).toBeVisible();
    
    // Refresh page and verify content persists
    await page.reload();
    await expect(page.locator('[data-testid="document-editor"]')).toHaveValue(testContent);
  });

  test('should request AI review', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    const projectHelper = new ProjectHelper(page);
    
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');
    
    // Add basic content
    await projectHelper.updateDocument(`
# Requirements Document

## Requirements

### Requirement 1: User Authentication
**User Story:** As a user, I want to authenticate, so that I can access the system.

#### Acceptance Criteria
1. WHEN user logs in THEN system SHALL authenticate
    `);
    
    // Request AI review
    await projectHelper.requestAIReview();
    
    // Verify AI review panel appears
    await expect(page.locator('[data-testid="ai-review-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-review-score"]')).toBeVisible();
  });

  test('should handle basic errors gracefully', async ({ page }) => {
    // Test 404 page
    await page.goto('/nonexistent-page');
    await expect(page.locator('[data-testid="not-found"]')).toBeVisible()
      .or(expect(page.locator('h1')).toContainText('404'));
    
    // Test invalid login
    const authHelper = new AuthHelper(page);
    await page.goto('/login');
    
    await page.fill('[data-testid="email-input"]', 'invalid@example.com');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    // Should show error message
    await expect(page.locator('[data-testid="login-error"]')).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    
    await authHelper.login(testUsers.developer);
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    await authHelper.logout();
    
    // Should redirect to login page
    await page.waitForURL('/login');
    await expect(page.locator('[data-testid="login-form"]')).toBeVisible();
  });
});