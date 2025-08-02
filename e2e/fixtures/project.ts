import type { Page } from '@playwright/test';

export type SpecificationPhase = 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';

export interface TestProject {
  name: string;
  description: string;
  phase: SpecificationPhase;
}

export const testProjects: Record<string, TestProject> = {
  ecommerce: {
    name: 'E-commerce Platform',
    description: 'A comprehensive e-commerce platform with user management and payment processing',
    phase: 'REQUIREMENTS',
  },
  chatApp: {
    name: 'Real-time Chat Application',
    description: 'A real-time messaging application with WebSocket support',
    phase: 'DESIGN',
  },
  taskManager: {
    name: 'Task Management System',
    description: 'A collaborative task management system for teams',
    phase: 'TASKS',
  },
};

export class ProjectHelper {
  constructor(private readonly page: Page) {}

  async createProject(project: TestProject): Promise<void> {
    await this.page.goto('/dashboard');
    
    // Click create project button
    await this.page.click('[data-testid="create-project-button"]');
    
    // Fill project form
    await this.page.fill('[data-testid="project-name-input"]', project.name);
    await this.page.fill('[data-testid="project-description-input"]', project.description);
    
    // Submit form
    await this.page.click('[data-testid="create-project-submit"]');
    
    // Wait for project creation success
    await this.page.waitForSelector('[data-testid="project-created-success"]');
    
    // Return to project list and verify creation
    await this.page.waitForSelector(`[data-testid="project-card-${project.name}"]`);
  }

  async openProject(projectName: string): Promise<void> {
    await this.page.goto('/dashboard');
    await this.page.click(`[data-testid="project-card-${projectName}"]`);
    await this.page.waitForSelector('[data-testid="specification-layout"]');
  }

  async navigateToPhase(phase: string): Promise<void> {
    await this.page.click(`[data-testid="phase-nav-${phase.toLowerCase()}"]`);
    await this.page.waitForSelector(`[data-testid="${phase.toLowerCase()}-editor"]`);
  }

  async updateDocument(content: string): Promise<void> {
    // Clear existing content
    await this.page.click('[data-testid="document-editor"]');
    await this.page.keyboard.press('Control+A');
    
    // Type new content
    await this.page.fill('[data-testid="document-editor"]', content);
    
    // Wait for auto-save
    await this.page.waitForSelector('[data-testid="save-indicator-saved"]', { timeout: 5000 });
  }

  async requestAIReview(): Promise<void> {
    await this.page.click('[data-testid="ai-review-button"]');
    await this.page.waitForSelector('[data-testid="ai-review-panel"]');
    
    // Wait for review to complete
    await this.page.waitForSelector('[data-testid="ai-review-score"]', { timeout: 30000 });
  }

  async applySuggestion(suggestionIndex: number): Promise<void> {
    await this.page.click(`[data-testid="suggestion-${suggestionIndex}-apply"]`);
    await this.page.waitForSelector(`[data-testid="suggestion-${suggestionIndex}-applied"]`);
  }

  async transitionPhase(targetPhase: string): Promise<void> {
    await this.page.click('[data-testid="phase-transition-button"]');
    await this.page.click(`[data-testid="transition-to-${targetPhase.toLowerCase()}"]`);
    
    // Wait for phase transition confirmation
    await this.page.waitForSelector('[data-testid="phase-transition-success"]');
  }
}