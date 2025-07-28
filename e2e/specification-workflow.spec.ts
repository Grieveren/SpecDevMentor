import { test, expect } from '@playwright/test';
import { AuthHelper, testUsers } from './fixtures/auth';
import { ProjectHelper, testProjects } from './fixtures/project';

test.describe('Specification Workflow', () => {
  let authHelper: AuthHelper;
  let projectHelper: ProjectHelper;

  test.beforeEach(async ({ page }) => {
    authHelper = new AuthHelper(page);
    projectHelper = new ProjectHelper(page);
    
    // Login as developer for most tests
    await authHelper.login(testUsers.developer);
  });

  test.afterEach(async ({ page }) => {
    await authHelper.logout();
  });

  test('should complete full specification workflow', async ({ page }) => {
    const project = testProjects.ecommerce;
    
    // Create new project
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);

    // Requirements Phase
    await projectHelper.navigateToPhase('REQUIREMENTS');
    
    const requirementsContent = `
# Requirements Document

## Introduction
E-commerce platform for online retail business.

## Requirements

### Requirement 1: User Authentication
**User Story:** As a customer, I want to create an account, so that I can make purchases.

#### Acceptance Criteria
1. WHEN a user registers THEN the system SHALL create a secure account
2. WHEN a user logs in THEN the system SHALL authenticate credentials
3. IF login fails THEN the system SHALL display error message
    `;
    
    await projectHelper.updateDocument(requirementsContent);
    
    // Request AI review for requirements
    await projectHelper.requestAIReview();
    
    // Verify AI review panel appears
    await expect(page.locator('[data-testid="ai-review-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="ai-review-score"]')).toBeVisible();
    
    // Apply first suggestion if available
    const firstSuggestion = page.locator('[data-testid="suggestion-0-apply"]');
    if (await firstSuggestion.isVisible()) {
      await projectHelper.applySuggestion(0);
    }

    // Transition to Design phase
    await projectHelper.transitionPhase('DESIGN');
    await projectHelper.navigateToPhase('DESIGN');

    // Design Phase
    const designContent = `
# Design Document

## Overview
Modern web application using React frontend and Node.js backend.

## Architecture
- Frontend: React with TypeScript
- Backend: Node.js with Express
- Database: PostgreSQL
- Authentication: JWT tokens

## Components
- User Management Service
- Product Catalog Service
- Order Processing Service
    `;
    
    await projectHelper.updateDocument(designContent);
    await projectHelper.requestAIReview();

    // Transition to Tasks phase
    await projectHelper.transitionPhase('TASKS');
    await projectHelper.navigateToPhase('TASKS');

    // Tasks Phase
    const tasksContent = `
# Implementation Plan

- [ ] 1. Set up project structure
  - Create React application
  - Set up Node.js server
  - Configure database connection

- [ ] 2. Implement user authentication
  - Create user registration endpoint
  - Implement login functionality
  - Add JWT token validation

- [ ] 3. Build product catalog
  - Create product model
  - Implement CRUD operations
  - Add search functionality
    `;
    
    await projectHelper.updateDocument(tasksContent);
    await projectHelper.requestAIReview();

    // Verify workflow completion
    await expect(page.locator('[data-testid="workflow-progress"]')).toContainText('Tasks');
    
    // Verify all phases are accessible
    await projectHelper.navigateToPhase('REQUIREMENTS');
    await expect(page.locator('[data-testid="requirements-editor"]')).toBeVisible();
    
    await projectHelper.navigateToPhase('DESIGN');
    await expect(page.locator('[data-testid="design-editor"]')).toBeVisible();
    
    await projectHelper.navigateToPhase('TASKS');
    await expect(page.locator('[data-testid="tasks-editor"]')).toBeVisible();
  });

  test('should prevent phase skipping', async ({ page }) => {
    const project = testProjects.ecommerce;
    
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);

    // Try to navigate directly to Design phase without completing Requirements
    await projectHelper.navigateToPhase('REQUIREMENTS');
    
    // Verify Design phase is disabled/locked
    const designNavButton = page.locator('[data-testid="phase-nav-design"]');
    await expect(designNavButton).toHaveAttribute('aria-disabled', 'true');
    
    // Verify Tasks phase is disabled/locked
    const tasksNavButton = page.locator('[data-testid="phase-nav-tasks"]');
    await expect(tasksNavButton).toHaveAttribute('aria-disabled', 'true');
  });

  test('should validate phase completion requirements', async ({ page }) => {
    const project = testProjects.ecommerce;
    
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);
    
    await projectHelper.navigateToPhase('REQUIREMENTS');
    
    // Try to transition without proper content
    await projectHelper.updateDocument('Incomplete requirements');
    
    // Attempt phase transition should fail
    await page.click('[data-testid="phase-transition-button"]');
    
    // Verify validation error appears
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
    await expect(page.locator('[data-testid="validation-error"]')).toContainText('Requirements incomplete');
  });

  test('should track workflow progress', async ({ page }) => {
    const project = testProjects.ecommerce;
    
    await projectHelper.createProject(project);
    await projectHelper.openProject(project.name);

    // Verify initial progress state
    await expect(page.locator('[data-testid="workflow-progress"]')).toContainText('Requirements');
    await expect(page.locator('[data-testid="progress-indicator-requirements"]')).toHaveClass(/active/);
    
    // Complete requirements and verify progress update
    await projectHelper.navigateToPhase('REQUIREMENTS');
    await projectHelper.updateDocument(`
# Requirements Document
## Introduction
Complete requirements document.
## Requirements
### Requirement 1: User Authentication
**User Story:** As a user, I want to authenticate, so that I can access the system.
#### Acceptance Criteria
1. WHEN user logs in THEN system SHALL authenticate
    `);
    
    await projectHelper.transitionPhase('DESIGN');
    
    // Verify progress updated
    await expect(page.locator('[data-testid="progress-indicator-requirements"]')).toHaveClass(/completed/);
    await expect(page.locator('[data-testid="progress-indicator-design"]')).toHaveClass(/active/);
  });
});