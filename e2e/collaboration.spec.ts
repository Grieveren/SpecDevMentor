import { test, expect } from '@playwright/test';
import { AuthHelper, testUsers } from './fixtures/auth';
import { ProjectHelper, testProjects } from './fixtures/project';

test.describe('Multi-User Collaboration', () => {
  test('should support real-time collaborative editing', async ({ browser }) => {
    // Create two browser contexts for different users
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    const authHelper1 = new AuthHelper(page1);
    const authHelper2 = new AuthHelper(page2);
    const projectHelper1 = new ProjectHelper(page1);
    const projectHelper2 = new ProjectHelper(page2);

    try {
      // Login as different users
      await authHelper1.login(testUsers.developer);
      await authHelper2.login(testUsers.teamLead);

      // User 1 creates project
      const project = testProjects.chatApp;
      await projectHelper1.createProject(project);
      
      // Share project with User 2 (assuming project sharing functionality)
      await page1.click('[data-testid="share-project-button"]');
      await page1.fill('[data-testid="share-email-input"]', testUsers.teamLead.email);
      await page1.click('[data-testid="send-invite-button"]');

      // User 2 opens shared project
      await projectHelper2.openProject(project.name);
      
      // Both users navigate to requirements phase
      await projectHelper1.navigateToPhase('REQUIREMENTS');
      await projectHelper2.navigateToPhase('REQUIREMENTS');

      // Verify both users see collaboration indicators
      await expect(page1.locator('[data-testid="collaboration-indicator"]')).toBeVisible();
      await expect(page2.locator('[data-testid="collaboration-indicator"]')).toBeVisible();
      
      // Verify user presence is shown
      await expect(page1.locator('[data-testid="active-user-team-lead"]')).toBeVisible();
      await expect(page2.locator('[data-testid="active-user-developer"]')).toBeVisible();

      // User 1 starts typing
      await page1.click('[data-testid="document-editor"]');
      await page1.type('[data-testid="document-editor"]', '# Requirements Document\n\n');

      // User 2 should see the changes in real-time
      await expect(page2.locator('[data-testid="document-editor"]')).toContainText('# Requirements Document');

      // User 2 adds content
      await page2.click('[data-testid="document-editor"]');
      await page2.keyboard.press('End');
      await page2.type('[data-testid="document-editor"]', '## Introduction\nChat application requirements.\n\n');

      // User 1 should see User 2's changes
      await expect(page1.locator('[data-testid="document-editor"]')).toContainText('Chat application requirements');

      // Test cursor tracking
      await page1.click('[data-testid="document-editor"]');
      await expect(page2.locator('[data-testid="cursor-developer"]')).toBeVisible();

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should handle collaborative comments and reviews', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    const authHelper1 = new AuthHelper(page1);
    const authHelper2 = new AuthHelper(page2);
    const projectHelper1 = new ProjectHelper(page1);
    const projectHelper2 = new ProjectHelper(page2);

    try {
      await authHelper1.login(testUsers.developer);
      await authHelper2.login(testUsers.teamLead);

      const project = testProjects.taskManager;
      await projectHelper1.createProject(project);
      
      // Share project
      await page1.click('[data-testid="share-project-button"]');
      await page1.fill('[data-testid="share-email-input"]', testUsers.teamLead.email);
      await page1.click('[data-testid="send-invite-button"]');

      await projectHelper2.openProject(project.name);
      
      await projectHelper1.navigateToPhase('REQUIREMENTS');
      await projectHelper2.navigateToPhase('REQUIREMENTS');

      // User 1 adds content
      await projectHelper1.updateDocument(`
# Requirements Document

## Introduction
Task management system for teams.

## Requirements

### Requirement 1: Task Creation
**User Story:** As a user, I want to create tasks, so that I can track work.

#### Acceptance Criteria
1. WHEN user creates task THEN system SHALL save task
2. WHEN task is saved THEN system SHALL notify team members
      `);

      // User 2 adds a comment
      await page2.click('[data-testid="add-comment-button"]');
      await page2.fill('[data-testid="comment-input"]', 'This requirement needs more detail about task priorities.');
      await page2.click('[data-testid="submit-comment-button"]');

      // User 1 should see the comment
      await expect(page1.locator('[data-testid="comment-thread"]')).toBeVisible();
      await expect(page1.locator('[data-testid="comment-content"]')).toContainText('task priorities');

      // User 1 replies to comment
      await page1.click('[data-testid="reply-to-comment-button"]');
      await page1.fill('[data-testid="reply-input"]', 'Good point! I will add priority levels.');
      await page1.click('[data-testid="submit-reply-button"]');

      // User 2 should see the reply
      await expect(page2.locator('[data-testid="comment-reply"]')).toContainText('priority levels');

      // User 2 resolves the comment
      await page2.click('[data-testid="resolve-comment-button"]');
      
      // Both users should see resolved status
      await expect(page1.locator('[data-testid="comment-status"]')).toContainText('Resolved');
      await expect(page2.locator('[data-testid="comment-status"]')).toContainText('Resolved');

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should handle approval workflow', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    const authHelper1 = new AuthHelper(page1);
    const authHelper2 = new AuthHelper(page2);
    const projectHelper1 = new ProjectHelper(page1);
    const projectHelper2 = new ProjectHelper(page2);

    try {
      await authHelper1.login(testUsers.developer);
      await authHelper2.login(testUsers.teamLead);

      const project = testProjects.ecommerce;
      await projectHelper1.createProject(project);
      
      // Share project
      await page1.click('[data-testid="share-project-button"]');
      await page1.fill('[data-testid="share-email-input"]', testUsers.teamLead.email);
      await page1.click('[data-testid="send-invite-button"]');

      await projectHelper2.openProject(project.name);
      
      await projectHelper1.navigateToPhase('REQUIREMENTS');
      
      // Developer completes requirements
      await projectHelper1.updateDocument(`
# Requirements Document

## Introduction
Complete e-commerce platform requirements.

## Requirements

### Requirement 1: User Management
**User Story:** As a customer, I want to manage my account, so that I can update my information.

#### Acceptance Criteria
1. WHEN user registers THEN system SHALL create account
2. WHEN user updates profile THEN system SHALL save changes
3. IF user forgets password THEN system SHALL send reset email
      `);

      // Developer requests approval
      await page1.click('[data-testid="request-approval-button"]');
      
      // Team lead should see approval request
      await projectHelper2.navigateToPhase('REQUIREMENTS');
      await expect(page2.locator('[data-testid="approval-request"]')).toBeVisible();
      await expect(page2.locator('[data-testid="approval-request"]')).toContainText('Approval Required');

      // Team lead reviews and approves
      await page2.click('[data-testid="review-document-button"]');
      await page2.fill('[data-testid="approval-comment"]', 'Requirements look good. Approved.');
      await page2.click('[data-testid="approve-button"]');

      // Developer should see approval
      await expect(page1.locator('[data-testid="approval-status"]')).toContainText('Approved');
      
      // Phase transition should now be enabled
      await expect(page1.locator('[data-testid="phase-transition-button"]')).not.toBeDisabled();

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should handle conflict resolution', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    const authHelper1 = new AuthHelper(page1);
    const authHelper2 = new AuthHelper(page2);
    const projectHelper1 = new ProjectHelper(page1);
    const projectHelper2 = new ProjectHelper(page2);

    try {
      await authHelper1.login(testUsers.developer);
      await authHelper2.login(testUsers.teamLead);

      const project = testProjects.chatApp;
      await projectHelper1.createProject(project);
      
      // Share project
      await page1.click('[data-testid="share-project-button"]');
      await page1.fill('[data-testid="share-email-input"]', testUsers.teamLead.email);
      await page1.click('[data-testid="send-invite-button"]');

      await projectHelper2.openProject(project.name);
      
      await projectHelper1.navigateToPhase('REQUIREMENTS');
      await projectHelper2.navigateToPhase('REQUIREMENTS');

      // Both users edit the same section simultaneously
      const initialContent = '# Requirements Document\n\n## Introduction\n';
      
      // User 1 adds content
      await page1.click('[data-testid="document-editor"]');
      await page1.keyboard.press('Control+A');
      await page1.type('[data-testid="document-editor"]', initialContent + 'Real-time messaging application.');

      // User 2 adds different content to same location
      await page2.click('[data-testid="document-editor"]');
      await page2.keyboard.press('Control+A');
      await page2.type('[data-testid="document-editor"]', initialContent + 'Chat application with WebSocket support.');

      // Conflict should be detected
      await expect(page1.locator('[data-testid="conflict-indicator"]')).toBeVisible();
      await expect(page2.locator('[data-testid="conflict-indicator"]')).toBeVisible();

      // Conflict resolution dialog should appear
      await expect(page1.locator('[data-testid="conflict-resolution-dialog"]')).toBeVisible();
      
      // User 1 chooses to merge changes
      await page1.click('[data-testid="merge-changes-button"]');
      
      // Verify merged content appears
      await expect(page1.locator('[data-testid="document-editor"]')).toContainText('Real-time messaging');
      await expect(page1.locator('[data-testid="document-editor"]')).toContainText('WebSocket support');

    } finally {
      await context1.close();
      await context2.close();
    }
  });
});