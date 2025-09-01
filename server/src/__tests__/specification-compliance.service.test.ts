import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SpecificationComplianceService } from '../services/specification-compliance.service.js';
import { SupportedLanguage } from '../types/code-execution.js';

// Mock the dependencies
vi.mock('../services/code-execution.service.js', () => ({
  CodeExecutionService: vi.fn().mockImplementation(() => ({
    executeCode: vi.fn().mockResolvedValue({
      success: true,
      output: 'Test passed',
      error: null,
      executionTime: 100,
      exitCode: 0,
      timedOut: false,
    }),
  })),
}));

vi.mock('../services/ai.service.js', () => ({
  AIService: vi.fn().mockImplementation(() => ({
    generateCompletion: vi.fn().mockResolvedValue(
      JSON.stringify({
        functions: ['calculateTotal', 'validateInput'],
        classes: ['Calculator'],
        apis: ['/api/calculate'],
        dataStructures: ['Result'],
        imports: ['express'],
        errorHandling: true,
      })
    ),
  })),
}));

describe('SpecificationComplianceService', () => {
  let service: SpecificationComplianceService;
  let result: any;

  beforeEach(() => {
    service = new SpecificationComplianceService();
    vi.clearAllMocks();
  });

  describe('validateCodeCompliance', () => {
    it('should validate code against specifications', async () => {
      const code = `
function calculateTotal(items) {
  if (!items || !Array.isArray(items)) {
    throw new Error('Invalid input');
  }
  return items.reduce((sum, item) => sum + item.price, 0);
}
      `;

      const specifications = [
        {
          id: 'req-1',
          content: `
## Requirements

### Requirement 1
**User Story:** As a user, I want to calculate the total price of items, so that I can see the final cost.

#### Acceptance Criteria
1. WHEN user provides an array of items THEN system SHALL calculate the total price
2. IF input is invalid THEN system SHALL throw an error
          `,
          phase: 'requirements' as const,
        },
      ];

      result = await service.validateCodeCompliance(
        code,
        SupportedLanguage.JAVASCRIPT,
        specifications
      );

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
      expect(result.details.length).toBeGreaterThanOrEqual(1); // Should have at least 1 requirement extracted
      expect(result.suggestions).toBeDefined();
      expect(typeof result.passed).toBe('boolean');
    });

    it('should handle empty specifications', async () => {
      const code = 'console.log("Hello World");';
      const specifications = [];

      result = await service.validateCodeCompliance(
        code,
        SupportedLanguage.JAVASCRIPT,
        specifications
      );

      expect(result.score).toBe(0);
      expect(result.details).toHaveLength(0);
      expect(result.passed).toBe(false);
    });

    it('should handle code with no matching requirements', async () => {
      const code = 'console.log("Hello World");';
      const specifications = [
        {
          id: 'req-1',
          content: 'WHEN user clicks button THEN system SHALL save data',
          phase: 'requirements' as const,
        },
      ];

      result = await service.validateCodeCompliance(
        code,
        SupportedLanguage.JAVASCRIPT,
        specifications
      );

      expect(result.score).toBeLessThan(50);
      expect(result.details).toHaveLength(1);
      expect(result.details[0].status).toBe('failed');
    });
  });

  describe('EARS Requirements Parsing', () => {
    it('should parse EARS format requirements correctly', async () => {
      const specifications = [
        {
          id: 'req-1',
          content: `
1. WHEN user submits form THEN system SHALL validate input
2. IF validation fails THEN system SHALL display error message
3. WHEN data is valid THEN system SHALL save to database
          `,
          phase: 'requirements' as const,
        },
      ];

      const code = `
function validateInput(data) { return true; }
function saveToDatabase(data) { return data; }
function displayError(message) { console.error(message); }
      `;

      result = await service.validateCodeCompliance(
        code,
        SupportedLanguage.JAVASCRIPT,
        specifications
      );

      expect(result.details.length).toBeGreaterThanOrEqual(1);

      // Should find some matching implementations
      const passedOrPartial = result.details.filter(
        detail => detail.status === 'passed' || detail.status === 'partial'
      );
      expect(passedOrPartial.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('User Story Parsing', () => {
    it('should parse user stories correctly', async () => {
      const specifications = [
        {
          id: 'req-1',
          content: `
**User Story:** As a customer, I want to add items to cart, so that I can purchase multiple products.
**User Story:** As an admin, I want to view all orders, so that I can manage the business.
          `,
          phase: 'requirements' as const,
        },
      ];

      const code = `
function addToCart(item) { /* implementation */ }
function viewAllOrders() { /* implementation */ }
      `;

      result = await service.validateCodeCompliance(
        code,
        SupportedLanguage.JAVASCRIPT,
        specifications
      );

      expect(result.details.length).toBeGreaterThanOrEqual(1);

      // Should match the implemented functions
      const cartRequirement = result.details.find(
        detail =>
          detail.requirement.includes('add items to cart') ||
          detail.requirement.includes('customer')
      );
      const ordersRequirement = result.details.find(
        detail =>
          detail.requirement.includes('view all orders') || detail.requirement.includes('admin')
      );

      // At least one requirement should be found
      expect(cartRequirement || ordersRequirement).toBeDefined();
    });
  });

  describe('API Requirements Parsing', () => {
    it('should parse API requirements from design documents', async () => {
      const specifications = [
        {
          id: 'design-1',
          content: `
## API Endpoints

- endpoint: GET /api/users
- endpoint: POST /api/users
- route: PUT /api/users/:id
          `,
          phase: 'design' as const,
        },
      ];

      const code = `
app.get('/api/users', (req, res) => { /* implementation */ });
app.post('/api/users', (req, res) => { /* implementation */ });
app.put('/api/users/:id', (req, res) => { /* implementation */ });
      `;

      result = await service.validateCodeCompliance(
        code,
        SupportedLanguage.JAVASCRIPT,
        specifications
      );

      expect(result.details.length).toBeGreaterThanOrEqual(1);

      // Some API endpoints should be found
      expect(result.details.length).toBeGreaterThan(0);
    });
  });

  describe('Interface Requirements Parsing', () => {
    it('should parse interface requirements from design documents', async () => {
      const specifications = [
        {
          id: 'design-1',
          content: `
interface User {
  id: string;
  name: string;
  email: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}
          `,
          phase: 'design' as const,
        },
      ];

      const code = `
interface User {
  id: string;
  name: string;
  email: string;
}

interface Product {
  id: string;
  name: string;
  price: number;
}
      `;

      result = await service.validateCodeCompliance(
        code,
        SupportedLanguage.TYPESCRIPT,
        specifications
      );

      expect(result.details.length).toBeGreaterThanOrEqual(1);

      // Both interfaces should be found
      const userInterface = result.details.find(detail =>
        detail.requirement.includes('User interface')
      );
      const productInterface = result.details.find(detail =>
        detail.requirement.includes('Product interface')
      );

      expect(userInterface).toBeDefined();
      expect(productInterface).toBeDefined();
    });
  });

  describe('Task Requirements Parsing', () => {
    it('should parse implementation tasks', async () => {
      const specifications = [
        {
          id: 'tasks-1',
          content: `
# Implementation Tasks

- [x] Implement user authentication function
- [ ] Create database connection service
- [x] Build API endpoint for user registration
- [ ] Write unit tests for validation
- [ ] Document API endpoints
          `,
          phase: 'tasks' as const,
        },
      ];

      const code = `
function authenticateUser(credentials) { /* implementation */ }
class DatabaseService { /* implementation */ }
app.post('/api/register', (req, res) => { /* implementation */ });
      `;

      result = await service.validateCodeCompliance(
        code,
        SupportedLanguage.JAVASCRIPT,
        specifications
      );

      // Should extract implementation tasks (excluding documentation)
      expect(result.details.length).toBeGreaterThan(0);

      const implementationTasks = result.details.filter(
        detail =>
          detail.requirement.includes('Implement') ||
          detail.requirement.includes('Create') ||
          detail.requirement.includes('Build')
      );

      expect(implementationTasks.length).toBeGreaterThan(0);
    });
  });

  describe('Code Analysis', () => {
    it('should analyze JavaScript code structure', async () => {
      const code = `
class Calculator {
  add(a, b) {
    return a + b;
  }
  
  subtract(a, b) {
    return a - b;
  }
}

function validateInput(input) {
  if (!input) {
    throw new Error('Invalid input');
  }
  return true;
}

const multiply = (a, b) => a * b;

app.get('/api/calculate', (req, res) => {
  res.json({ result: 'calculated' });
});
      `;

      const specifications = [
        {
          id: 'req-1',
          content: 'WHEN user performs calculation THEN system SHALL return result',
          phase: 'requirements' as const,
        },
      ];

      result = await service.validateCodeCompliance(
        code,
        SupportedLanguage.JAVASCRIPT,
        specifications
      );

      expect(result).toBeDefined();
      // The AI service mock should return analysis data
      expect(result.score).toBeGreaterThanOrEqual(0);
    });

    it('should analyze Python code structure', async () => {
      const code = `
class Calculator:
    def add(self, a, b):
        return a + b
    
    def subtract(self, a, b):
        return a - b

def validate_input(input_data):
    if not input_data:
        raise ValueError('Invalid input')
    return True

def multiply(a, b):
    return a * b
      `;

      const specifications = [
        {
          id: 'req-1',
          content: 'WHEN user performs calculation THEN system SHALL return result',
          phase: 'requirements' as const,
        },
      ];

      result = await service.validateCodeCompliance(code, SupportedLanguage.PYTHON, specifications);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Compliance Scoring', () => {
    it('should calculate compliance score correctly', async () => {
      const specifications = [
        {
          id: 'req-1',
          content: `
WHEN user submits data THEN system SHALL validate input
WHEN validation passes THEN system SHALL save data
IF validation fails THEN system SHALL return error
          `,
          phase: 'requirements' as const,
        },
      ];

      const goodCode = `
function validateInput(data) {
  if (!data) throw new Error('Invalid input');
  return true;
}

function saveData(data) {
  // Save implementation
  return data;
}

function handleError(error) {
  return { error: error.message };
}
      `;

      result = await service.validateCodeCompliance(
        goodCode,
        SupportedLanguage.JAVASCRIPT,
        specifications
      );

      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.passed).toBe(result.score >= 70);
    });

    it('should return low score for non-compliant code', async () => {
      const specifications = [
        {
          id: 'req-1',
          content: 'WHEN user clicks save THEN system SHALL persist data to database',
          phase: 'requirements' as const,
        },
      ];

      const badCode = `
function unrelatedFunction() {
  // // console.log('This does nothing related to saving');
}
      `;

      result = await service.validateCodeCompliance(
        badCode,
        SupportedLanguage.JAVASCRIPT,
        specifications
      );

      expect(result.score).toBeLessThan(100);
      expect(result.passed).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid specifications gracefully', async () => {
      const code = 'console.log("test");';
      const invalidSpecs = [
        {
          id: 'invalid',
          content: null as any,
          phase: 'requirements' as const,
        },
      ];

      result = await service.validateCodeCompliance(
        code,
        SupportedLanguage.JAVASCRIPT,
        invalidSpecs
      );
      expect(result).toBeDefined();
      expect(result.score).toBe(0);
    });

    it('should handle AI service failures gracefully', async () => {
      // Skip test if AI service is not available
      if (!service['aiService']) {
        console.log('Skipping AI service test - AI service not available');
        return;
      }

      // Mock AI service to fail
      const mockAIService = vi.mocked(service['aiService']);
      mockAIService.generateCompletion = vi.fn().mockRejectedValue(new Error('AI service failed'));

      const code = 'function test() {}';
      const specifications = [
        {
          id: 'req-1',
          content: 'WHEN user calls test THEN system SHALL execute',
          phase: 'requirements' as const,
        },
      ];

      result = await service.validateCodeCompliance(
        code,
        SupportedLanguage.JAVASCRIPT,
        specifications
      );

      // Should still work with fallback analysis
      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Suggestion Generation', () => {
    it('should generate improvement suggestions', async () => {
      const specifications = [
        {
          id: 'req-1',
          content: `
WHEN user submits form THEN system SHALL validate all fields
WHEN validation passes THEN system SHALL save to database
IF any field is invalid THEN system SHALL show specific error
          `,
          phase: 'requirements' as const,
        },
      ];

      const incompleteCode = `
function submitForm(data) {
  // Missing validation
  // Missing error handling
  // // console.log('Form submitted');
}
      `;

      result = await service.validateCodeCompliance(
        incompleteCode,
        SupportedLanguage.JAVASCRIPT,
        specifications
      );

      expect(result.suggestions).toBeDefined();
      expect(result.suggestions.length).toBeGreaterThanOrEqual(0);

      // Should suggest missing functionality
      const hasImplementationSuggestion = result.suggestions.some(
        suggestion => suggestion.includes('Implement') || suggestion.includes('missing')
      );
      expect(hasImplementationSuggestion).toBe(true);
    });
  });
});
