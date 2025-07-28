import { Page } from '@playwright/test';

export interface TestUser {
  id: string;
  email: string;
  name: string;
  password: string;
  role: 'STUDENT' | 'DEVELOPER' | 'TEAM_LEAD' | 'ADMIN';
}

export const testUsers: Record<string, TestUser> = {
  admin: {
    id: 'admin-user-id',
    email: 'admin@codementor-ai.com',
    name: 'Admin User',
    password: 'admin123',
    role: 'ADMIN',
  },
  teamLead: {
    id: 'team-lead-id',
    email: 'lead@codementor-ai.com',
    name: 'Team Lead',
    password: 'lead123',
    role: 'TEAM_LEAD',
  },
  developer: {
    id: 'developer-id',
    email: 'dev@codementor-ai.com',
    name: 'Developer',
    password: 'dev123',
    role: 'DEVELOPER',
  },
  student: {
    id: 'student-id',
    email: 'student@codementor-ai.com',
    name: 'Student',
    password: 'student123',
    role: 'STUDENT',
  },
};

export class AuthHelper {
  constructor(private page: Page) {}

  async login(user: TestUser) {
    await this.page.goto('/login');
    
    // Fill login form
    await this.page.fill('[data-testid="email-input"]', user.email);
    await this.page.fill('[data-testid="password-input"]', user.password);
    
    // Submit form
    await this.page.click('[data-testid="login-button"]');
    
    // Wait for successful login redirect
    await this.page.waitForURL('/dashboard', { timeout: 10000 });
    
    // Verify user is logged in
    await this.page.waitForSelector('[data-testid="user-menu"]');
  }

  async logout() {
    await this.page.click('[data-testid="user-menu"]');
    await this.page.click('[data-testid="logout-button"]');
    await this.page.waitForURL('/login');
  }

  async register(user: Omit<TestUser, 'id'>) {
    await this.page.goto('/register');
    
    await this.page.fill('[data-testid="name-input"]', user.name);
    await this.page.fill('[data-testid="email-input"]', user.email);
    await this.page.fill('[data-testid="password-input"]', user.password);
    await this.page.fill('[data-testid="confirm-password-input"]', user.password);
    
    await this.page.click('[data-testid="register-button"]');
    
    // Wait for registration success
    await this.page.waitForSelector('[data-testid="registration-success"]');
  }

  async isLoggedIn(): Promise<boolean> {
    try {
      await this.page.waitForSelector('[data-testid="user-menu"]', { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
}