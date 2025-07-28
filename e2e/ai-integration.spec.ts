import { test, expect } from '@playwright/test';
import { AuthHelper, testUsers } from './fixtures/auth';
import { ProjectHelper, testProjects } from './fixtures/project';

test.describe('AI Integration', () => {
  let authHelper: AuthHelper;
  let projectHelper: ProjectHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    projectHelper = new ProjectHelper(page);
    
    await authHelper.login(testUsers.developer);
  });

  test.afterEach(async ({ page }) => {
    await authHelper.logout();
  });

  test('should provide AI-powered specification review', async ({ page }) => {
    const project = testProjects.ecommerce;
    
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    // Add requirements content
    const requirementsContent = `
# Requirements Document

## Introduction
E-commerce platform for online retail.

## Requirements

### Requirement 1: User Authentication
**User Story:** As a customer, I want to create an account, so that I can make purchases.

#### Acceptance Criteria
1. WHEN a user registers THEN the system SHALL create a secure account
2. WHEN a user logs in THEN the system SHALL authenticate credentials
3. IF login fails THEN the system SHALL display error message

### Requirement 2: Product Catalog
**User Story:** As a customer, I want to browse products, so that I can find items to purchase.

#### Acceptance Criteria
1. WHEN user views catalog THEN system SHALL display available products
2. WHEN user searches products THEN system SHALL filter results
    `;

    await projectHelper.updateDocument(requirementsContent);

    // Request AI review
    await projectHelper.requestAIReview();

    // Verify AI review panel appears
    await expect(page.locator('[data-testid="ai-review-panel"]')).toBeVisible();
    
    // Verify review components
    await expect(page.locator('[data-testid="ai-review-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="quality-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="suggestions-list"]')).toBeVisible();

    // Verify score is displayed
    const scoreElement = page.locator('[data-testid="ai-review-score"]');
    const scoreText = await scoreElement.textContent();
    expect(scoreText).toMatch(/\d+/); // Should contain a number

    // Verify suggestions are provided
    const suggestions = page.locator('[data-testid="suggestion-card"]');
    await expect(suggestions.first()).toBeVisible();

    // Check suggestion details
    const firstSuggestion = suggestions.first();
    await expect(firstSuggestion.locator('[data-testid="suggestion-type"]')).toBeVisible();
    await expect(firstSuggestion.locator('[data-testid="suggestion-content"]')).toBeVisible();
    await expect(firstSuggestion.locator('[data-testid="suggestion-reasoning"]')).toBeVisible();
  });

  test('should apply AI suggestions to document', async ({ page }) => {
    const project = testProjects.taskManager;
    
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    // Add incomplete requirements
    await projectHelper.updateDocument(`
# Requirements Document

## Requirements

### Requirement 1: Task Creation
**User Story:** As a user, I want to create tasks.

#### Acceptance Criteria
1. User can create tasks
    `);

    await projectHelper.requestAIReview();

    // Wait for suggestions to load
    await expect(page.locator('[data-testid="suggestion-card"]')).toBeVisible();

    // Get original document content
    const originalContent = await page.locator('[data-testid="document-editor"]').inputValue();

    // Apply first suggestion
    await projectHelper.applySuggestion(0);

    // Verify document content changed
    const updatedContent = await page.locator('[data-testid="document-editor"]').inputValue();
    expect(updatedContent).not.toBe(originalContent);

    // Verify suggestion is marked as applied
    await expect(page.locator('[data-testid="suggestion-0-applied"]')).toBeVisible();

    // Verify undo functionality
    await page.click('[data-testid="suggestion-0-undo"]');
    const revertedContent = await page.locator('[data-testid="document-editor"]').inputValue();
    expect(revertedContent).toBe(originalContent);
  });

  test('should validate EARS format compliance', async ({ page }) => {
    const project = testProjects.chatApp;
    
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    // Add non-EARS format requirements
    await projectHelper.updateDocument(`
# Requirements Document

## Requirements

### Requirement 1: Messaging
**User Story:** As a user, I want to send messages.

#### Acceptance Criteria
1. Users can send messages
2. Messages are delivered
3. Users receive notifications
    `);

    await projectHelper.requestAIReview();

    // Verify EARS format validation
    await expect(page.locator('[data-testid="ears-validation"]')).toBeVisible();
    await expect(page.locator('[data-testid="ears-validation"]')).toContainText('EARS format');

    // Verify specific EARS suggestions
    const earsSuggestions = page.locator('[data-testid="suggestion-card"]').filter({
      hasText: 'WHEN'
    });
    await expect(earsSuggestions.first()).toBeVisible();
  });

  test('should provide phase-specific AI guidance', async ({ page }) => {
    const project = testProjects.ecommerce;
    
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);

    // Test Requirements phase guidance
    await projectHelper.navigateToPhase('REQUIREMENTS');
    await projectHelper.updateDocument('# Requirements Document\n\nBasic requirements.');
    await projectHelper.requestAIReview();

    await expect(page.locator('[data-testid="phase-guidance-requirements"]')).toBeVisible();
    await expect(page.locator('[data-testid="phase-guidance-requirements"]')).toContainText('user stories');

    // Transition to Design phase
    await projectHelper.updateDocument(`
# Requirements Document

## Requirements

### Requirement 1: User Authentication
**User Story:** As a customer, I want to create an account, so that I can make purchases.

#### Acceptance Criteria
1. WHEN a user registers THEN the system SHALL create a secure account
    `);
    
    await projectHelper.transitionPhase('DESIGN');
    await projectHelper.navigateToPhase('DESIGN');

    // Test Design phase guidance
    await projectHelper.updateDocument('# Design Document\n\nBasic design.');
    await projectHelper.requestAIReview();

    await expect(page.locator('[data-testid="phase-guidance-design"]')).toBeVisible();
    await expect(page.locator('[data-testid="phase-guidance-design"]')).toContainText('architecture');
  });

  test('should handle AI service errors gracefully', async ({ page }) => {
    const project = testProjects.taskManager;
    
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    await projectHelper.updateDocument('# Requirements Document\n\nTest content.');

    // Mock AI service failure
    await page.route('**/api/ai/review', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'AI service unavailable' })
      });
    });

    // Request AI review
    await page.click('[data-testid="ai-review-button"]');

    // Verify error handling
    await expect(page.locator('[data-testid="ai-error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-error-message"]')).toContainText('AI service unavailable');

    // Verify retry functionality
    await expect(page.locator('[data-testid="ai-retry-button"]')).toBeVisible();
  });

  test('should track AI usage and costs', async ({ page }) => {
    const project = testProjects.ecommerce;
    
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    await projectHelper.updateDocument(`
# Requirements Document

## Requirements

### Requirement 1: User Authentication
**User Story:** As a customer, I want to create an account, so that I can make purchases.

#### Acceptance Criteria
1. WHEN a user registers THEN the system SHALL create a secure account
    `);

    // Request multiple AI reviews
    await projectHelper.requestAIReview();
    await page.waitForSelector('[data-testid="ai-review-score"]');

    // Navigate to usage dashboard
    await page.click('[data-testid="user-menu"]');
    await page.click('[data-testid="ai-usage-link"]');

    // Verify usage tracking
    await expect(page.locator('[data-testid="ai-usage-dashboard"]')).toBeVisible();
    await expect(page.locator('[data-testid="tokens-used"]')).toBeVisible();
    await expect(page.locator('[data-testid="estimated-cost"]')).toBeVisible();
    await expect(page.locator('[data-testid="usage-history"]')).toBeVisible();
  });
});