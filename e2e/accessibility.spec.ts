import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { AuthHelper, testUsers } from './fixtures/auth';
import { ProjectHelper, testProjects } from './fixtures/project';

test.describe('Accessibility Tests @accessibility', () => {
  let authHelper: AuthHelper;
  let projectHelper: ProjectHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    projectHelper = new ProjectHelper(page);
  });

  test('should have no accessibility violations on login page', async ({ page }) => {
    await page.goto('/login');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have no accessibility violations on registration page', async ({ page }) => {
    await page.goto('/register');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have no accessibility violations on dashboard', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    await page.goto('/dashboard');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have no accessibility violations on specification editor', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');
    
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('/login');
    
    // Test tab navigation through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="email-input"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="password-input"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="login-button"]')).toBeFocused();
    
    // Test form submission with Enter key
    await page.fill('[data-testid="email-input"]', testUsers.developer.email);
    await page.fill('[data-testid="password-input"]', testUsers.developer.password);
    await page.keyboard.press('Enter');
    
    // Should navigate to dashboard
    await page.waitForURL('/dashboard');
  });

  test('should support keyboard navigation in specification editor', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.taskManager;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    
    // Test keyboard navigation between phases
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Navigate to requirements phase with keyboard
    await page.locator('[data-testid="phase-nav-requirements"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="requirements-editor"]')).toBeVisible();
    
    // Navigate to design phase with keyboard
    await page.locator('[data-testid="phase-nav-design"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-testid="design-editor"]')).toBeVisible();
  });

  test('should have proper ARIA labels and roles', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    await page.goto('/dashboard');
    
    // Check main navigation has proper ARIA labels
    await expect(page.locator('[role="navigation"]')).toBeVisible();
    await expect(page.locator('[aria-label="Main navigation"]')).toBeVisible();
    
    // Check buttons have proper labels
    const createButton = page.locator('[data-testid="create-project-button"]');
    await expect(createButton).toHaveAttribute('aria-label');
    
    // Check form elements have proper labels
    await page.click('[data-testid="create-project-button"]');
    
    const nameInput = page.locator('[data-testid="project-name-input"]');
    await expect(nameInput).toHaveAttribute('aria-label');
    
    const descriptionInput = page.locator('[data-testid="project-description-input"]');
    await expect(descriptionInput).toHaveAttribute('aria-label');
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    
    // Check heading hierarchy
    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    
    const h2Elements = page.locator('h2');
    const h2Count = await h2Elements.count();
    expect(h2Count).toBeGreaterThan(0);
    
    // Verify no heading levels are skipped
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    const headingLevels = await Promise.all(
      headings.map(async (heading) => {
        const tagName = await heading.evaluate(el => el.tagName.toLowerCase());
        return parseInt(tagName.charAt(1));
      })
    );
    
    // Check that heading levels don't skip (e.g., h1 -> h3 without h2)
    for (let i = 1; i < headingLevels.length; i++) {
      const currentLevel = headingLevels[i];
      const previousLevel = headingLevels[i - 1];
      expect(currentLevel - previousLevel).toBeLessThanOrEqual(1);
    }
  });

  test('should have sufficient color contrast', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    await page.goto('/dashboard');
    
    // Run axe-core with color contrast rules
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .include('[data-testid="project-list"]')
      .analyze();

    // Filter for color contrast violations
    const colorContrastViolations = accessibilityScanResults.violations.filter(
      violation => violation.id === 'color-contrast'
    );
    
    expect(colorContrastViolations).toEqual([]);
  });

  test('should support screen reader announcements', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    
    const project = testProjects.chatApp;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    
    // Check for live regions for dynamic content
    await expect(page.locator('[aria-live="polite"]')).toBeVisible();
    
    // Test AI review announcements
    await projectHelper.navigateToPhase('REQUIREMENTS');
    await projectHelper.updateDocument(`
# Requirements Document

## Requirements

### Requirement 1: Real-time Messaging
**User Story:** As a user, I want to send messages, so that I can communicate.

#### Acceptance Criteria
1. WHEN user sends message THEN system SHALL deliver message
    `);
    
    await projectHelper.requestAIReview();
    
    // Check that AI review results are announced
    await expect(page.locator('[aria-live="polite"]')).toContainText('AI review completed');
  });

  test('should handle focus management properly', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    await page.goto('/dashboard');
    
    // Test modal focus management
    await page.click('[data-testid="create-project-button"]');
    
    // Focus should move to modal
    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();
    
    // First focusable element should be focused
    const firstInput = modal.locator('[data-testid="project-name-input"]');
    await expect(firstInput).toBeFocused();
    
    // Test focus trap - Tab should cycle within modal
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Should cycle back to first element
    
    // Close modal with Escape
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible();
    
    // Focus should return to trigger button
    await expect(page.locator('[data-testid="create-project-button"]')).toBeFocused();
  });

  test('should provide alternative text for images', async ({ page }) => {
    await authHelper.login(testUsers.developer);
    await page.goto('/dashboard');
    
    // Check all images have alt text
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);
      const altText = await image.getAttribute('alt');
      
      // Alt text should exist (can be empty for decorative images)
      expect(altText).not.toBeNull();
    }
  });

  test('should support high contrast mode', async ({ page }) => {
    // Enable high contrast mode simulation
    await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });
    
    await authHelper.login(testUsers.developer);
    await page.goto('/dashboard');
    
    // Run accessibility scan with forced colors
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should be responsive and accessible on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await authHelper.login(testUsers.developer);
    await page.goto('/dashboard');
    
    // Run accessibility scan on mobile viewport
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
    
    // Test touch targets are large enough (minimum 44x44px)
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const button = buttons.nth(i);
      const boundingBox = await button.boundingBox();
      
      if (boundingBox) {
        expect(boundingBox.width).toBeGreaterThanOrEqual(44);
        expect(boundingBox.height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});