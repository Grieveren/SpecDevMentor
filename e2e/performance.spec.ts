import { test, expect } from '@playwright/test';
import { AuthHelper, testUsers } from './fixtures/auth';
import { ProjectHelper, testProjects } from './fixtures/project';

test.describe('Performance Tests', () => {
  test('should handle concurrent user editing', async ({ browser }) => {
    const userCount = 5;
    const contexts = [];
    const pages = [];
    const authHelpers = [];
    const projectHelpers = [];

    try {
      // Create multiple browser contexts
      for (let i = 0; i < userCount; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        contexts.push(context);
        pages.push(page);
        authHelpers.push(new AuthHelper(page));
        projectHelpers.push(new ProjectHelper(page));
      }

      // Login all users
      await Promise.all(authHelpers.map((helper, i) => 
        helper.login(i === 0 ? testUsers.teamLead : testUsers.developer)
      ));

      // First user creates project
      const project = testProjects.ecommerce;
      await projectHelpers[0].createProject(project);

      // Share project with all users
      for (let i = 1; i < userCount; i++) {
        await pages[0].click('[data-testid="share-project-button"]');
        await pages[0].fill('[data-testid="share-email-input"]', testUsers.developer.email);
        await pages[0].click('[data-testid="send-invite-button"]');
      }

      // All users open the project
      await Promise.all(projectHelpers.map(helper => 
        helper.openProject(project.name)
      ));

      // All users navigate to requirements phase
      await Promise.all(projectHelpers.map(helper => 
        helper.navigateToPhase('REQUIREMENTS')
      ));

      // Measure performance of concurrent editing
      const startTime = Date.now();

      // All users edit simultaneously
      const editPromises = pages.map(async (page, i) => {
        const content = `
# Requirements Document - User ${i + 1}

## Introduction
E-commerce platform requirements from user ${i + 1}.

## Requirements

### Requirement ${i + 1}: Feature ${i + 1}
**User Story:** As a user ${i + 1}, I want feature ${i + 1}, so that I can achieve goal ${i + 1}.

#### Acceptance Criteria
1. WHEN user ${i + 1} performs action THEN system SHALL respond
2. IF condition ${i + 1} occurs THEN system SHALL handle it
        `;

        await page.click('[data-testid="document-editor"]');
        await page.keyboard.press('Control+A');
        await page.type('[data-testid="document-editor"]', content);
        
        // Wait for auto-save
        await page.waitForSelector('[data-testid="save-indicator-saved"]', { timeout: 10000 });
      });

      await Promise.all(editPromises);

      const editTime = Date.now() - startTime;
      console.log(`Concurrent editing completed in ${editTime}ms`);

      // Verify all changes are synchronized
      const finalContent = await pages[0].locator('[data-testid="document-editor"]').inputValue();
      
      for (let i = 1; i < userCount; i++) {
        const userContent = await pages[i].locator('[data-testid="document-editor"]').inputValue();
        expect(userContent).toBe(finalContent);
      }

      // Performance assertion - should complete within reasonable time
      expect(editTime).toBeLessThan(30000); // 30 seconds max

    } finally {
      // Cleanup
      await Promise.all(contexts.map(context => context.close()));
    }
  });

  test('should handle high-frequency AI review requests', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    const projectHelper = new ProjectHelper(page);

    await authHelper.login(testUsers.developer);

    const project = testProjects.taskManager;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    // Prepare test content
    const baseContent = `
# Requirements Document

## Requirements

### Requirement 1: Task Management
**User Story:** As a user, I want to manage tasks, so that I can track work.

#### Acceptance Criteria
1. WHEN user creates task THEN system SHALL save task
    `;

    await projectHelper.updateDocument(baseContent);

    // Measure AI review performance
    const reviewCount = 10;
    const reviewTimes = [];

    for (let i = 0; i < reviewCount; i++) {
      // Modify content slightly to trigger new review
      const modifiedContent = baseContent + `\n// Modification ${i + 1}`;
      await projectHelper.updateDocument(modifiedContent);

      const startTime = Date.now();
      
      // Request AI review
      await projectHelper.requestAIReview();
      
      // Wait for review completion
      await page.waitForSelector('[data-testid="ai-review-score"]', { timeout: 30000 });
      
      const reviewTime = Date.now() - startTime;
      reviewTimes.push(reviewTime);
      
      console.log(`AI Review ${i + 1} completed in ${reviewTime}ms`);
    }

    // Calculate performance metrics
    const avgReviewTime = reviewTimes.reduce((sum, time) => sum + time, 0) / reviewCount;
    const maxReviewTime = Math.max(...reviewTimes);
    const minReviewTime = Math.min(...reviewTimes);

    console.log(`Average review time: ${avgReviewTime}ms`);
    console.log(`Max review time: ${maxReviewTime}ms`);
    console.log(`Min review time: ${minReviewTime}ms`);

    // Performance assertions
    expect(avgReviewTime).toBeLessThan(15000); // 15 seconds average
    expect(maxReviewTime).toBeLessThan(30000); // 30 seconds max
  });

  test('should handle large document processing', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    const projectHelper = new ProjectHelper(page);

    await authHelper.login(testUsers.developer);

    const project = testProjects.ecommerce;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    // Generate large document content
    let largeContent = '# Requirements Document\n\n## Introduction\nLarge requirements document.\n\n## Requirements\n\n';
    
    for (let i = 1; i <= 50; i++) {
      largeContent += `
### Requirement ${i}: Feature ${i}
**User Story:** As a user, I want feature ${i}, so that I can achieve goal ${i}.

#### Acceptance Criteria
1. WHEN user performs action ${i} THEN system SHALL respond appropriately
2. IF condition ${i} occurs THEN system SHALL handle it correctly
3. WHEN user completes task ${i} THEN system SHALL update status

      `;
    }

    const startTime = Date.now();

    // Update document with large content
    await projectHelper.updateDocument(largeContent);

    const updateTime = Date.now() - startTime;
    console.log(`Large document update completed in ${updateTime}ms`);

    // Request AI review for large document
    const reviewStartTime = Date.now();
    await projectHelper.requestAIReview();
    await page.waitForSelector('[data-testid="ai-review-score"]', { timeout: 60000 });
    
    const reviewTime = Date.now() - reviewStartTime;
    console.log(`Large document AI review completed in ${reviewTime}ms`);

    // Performance assertions
    expect(updateTime).toBeLessThan(10000); // 10 seconds for update
    expect(reviewTime).toBeLessThan(60000); // 60 seconds for AI review

    // Verify functionality still works
    await expect(page.locator('[data-testid="ai-review-score"]')).toBeVisible();
    await expect(page.locator('[data-testid="suggestions-list"]')).toBeVisible();
  });

  test('should maintain responsiveness during heavy operations', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    const projectHelper = new ProjectHelper(page);

    await authHelper.login(testUsers.developer);

    const project = testProjects.chatApp;
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    await projectHelper.navigateToPhase('REQUIREMENTS');

    // Start heavy operation (AI review)
    await projectHelper.updateDocument(`
# Requirements Document

## Requirements

### Requirement 1: Real-time Messaging
**User Story:** As a user, I want to send real-time messages, so that I can communicate instantly.

#### Acceptance Criteria
1. WHEN user sends message THEN system SHALL deliver immediately
2. WHEN message is received THEN system SHALL notify recipient
3. IF connection is lost THEN system SHALL queue messages
    `);

    // Start AI review (heavy operation)
    const reviewPromise = projectHelper.requestAIReview();

    // Test UI responsiveness during heavy operation
    const responsivenessTasks = [
      // Test navigation
      async () => {
        await page.click('[data-testid="phase-nav-design"]');
        await page.waitForSelector('[data-testid="design-editor"]', { timeout: 5000 });
        await page.click('[data-testid="phase-nav-requirements"]');
        await page.waitForSelector('[data-testid="requirements-editor"]', { timeout: 5000 });
      },
      
      // Test menu interactions
      async () => {
        await page.click('[data-testid="user-menu"]');
        await page.waitForSelector('[data-testid="user-dropdown"]', { timeout: 2000 });
        await page.click('[data-testid="user-menu"]'); // Close menu
      },
      
      // Test document scrolling
      async () => {
        await page.locator('[data-testid="document-editor"]').scroll({ top: 100 });
        await page.locator('[data-testid="document-editor"]').scroll({ top: 0 });
      }
    ];

    // Execute responsiveness tests while AI review is running
    const responsivenessPromises = responsivenessTasks.map(async (task, index) => {
      const startTime = Date.now();
      await task();
      const responseTime = Date.now() - startTime;
      console.log(`Responsiveness test ${index + 1} completed in ${responseTime}ms`);
      return responseTime;
    });

    // Wait for both heavy operation and responsiveness tests
    const [reviewResult, responseTimes] = await Promise.all([
      reviewPromise,
      Promise.all(responsivenessPromises)
    ]);

    // Verify responsiveness maintained
    const maxResponseTime = Math.max(...responseTimes);
    expect(maxResponseTime).toBeLessThan(5000); // UI should remain responsive (< 5s)

    // Verify heavy operation completed successfully
    await expect(page.locator('[data-testid="ai-review-score"]')).toBeVisible();
  });

  test('should handle memory usage efficiently', async ({ page }) => {
    const authHelper = new AuthHelper(page);
    const projectHelper = new ProjectHelper(page);

    await authHelper.login(testUsers.developer);

    // Create multiple projects to test memory usage
    const projectCount = 10;
    const projects = [];

    for (let i = 0; i < projectCount; i++) {
      const project = {
        name: `Performance Test Project ${i + 1}`,
        description: `Test project ${i + 1} for memory usage testing`,
        phase: 'REQUIREMENTS' as const
      };
      
      await projectHelper.createProject(project);
      projects.push(project);
    }

    // Navigate between projects rapidly
    for (let i = 0; i < projectCount; i++) {
      await projectHelper.openProject(projects[i].name);
      await projectHelper.navigateToPhase('REQUIREMENTS');
      
      // Add content to each project
      await projectHelper.updateDocument(`
# Requirements Document ${i + 1}

## Requirements

### Requirement 1: Feature ${i + 1}
**User Story:** As a user, I want feature ${i + 1}, so that I can use the system.

#### Acceptance Criteria
1. WHEN user accesses feature ${i + 1} THEN system SHALL respond
      `);

      // Brief pause to allow memory cleanup
      await page.waitForTimeout(100);
    }

    // Verify application is still responsive
    await page.goto('/dashboard');
    await expect(page.locator('[data-testid="project-list"]')).toBeVisible();
    
    // Verify all projects are listed
    for (const project of projects) {
      await expect(page.locator(`[data-testid="project-card-${project.name}"]`)).toBeVisible();
    }
  });
});