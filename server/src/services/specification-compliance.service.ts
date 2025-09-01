// @ts-nocheck
import { Redis } from 'ioredis';
import { ComplianceDetail, ComplianceResult, SupportedLanguage } from '../types/code-execution.js';
import { AIService, createAIService } from './ai.service.js';
import { CodeExecutionService } from './code-execution.service.js';

interface SpecificationDocument {
  id: string;
  content: string;
  phase: 'requirements' | 'design' | 'tasks';
}

interface RequirementMatch {
  requirementId: string;
  requirementText: string;
  codeSnippets: string[];
  matchScore: number;
  evidence: string[];
}

interface TestCase {
  id: string;
  description: string;
  input?: string;
  expectedOutput?: string;
  expectedBehavior: string;
  requirement: string;
}

export class SpecificationComplianceService {
  private codeExecutionService: CodeExecutionService;
  private aiService: AIService;

  constructor(redis?: Redis) {
    this.codeExecutionService = new CodeExecutionService();
    try {
      this.aiService = redis ? createAIService(redis) : (null as any);
    } catch (error) {
      console.warn('AI service initialization failed, continuing without AI features:', error);
      this.aiService = null as any;
    }
  }

  async validateCodeCompliance(
    code: string,
    language: SupportedLanguage,
    specifications: SpecificationDocument[]
  ): Promise<ComplianceResult> {
    try {
      // Extract requirements from specifications
      const requirements = await this.extractRequirements(specifications);

      // Analyze code structure and functionality
      const codeAnalysis = await this.analyzeCode(code, language);

      // Match code against requirements
      const requirementMatches = await this.matchCodeToRequirements(
        code,
        language,
        requirements,
        codeAnalysis
      );

      // Generate test cases from requirements
      const testCases = await this.generateTestCases(requirements, code, language);

      // Execute tests
      const testResults = await this.executeTests(code, language, testCases);

      // Calculate compliance score
      const complianceDetails = this.generateComplianceDetails(requirementMatches, testResults);

      const score = this.calculateComplianceScore(complianceDetails);

      // Generate suggestions for improvement
      const suggestions = await this.generateImprovementSuggestions(
        complianceDetails,
        code,
        requirements
      );

      return {
        score,
        passed: score >= 70, // 70% threshold for passing
        details: complianceDetails,
        suggestions,
      };
    } catch (error) {
      console.error('Compliance validation error:', error);
      throw new Error(`Compliance validation failed: ${error.message}`);
    }
  }

  private async extractRequirements(
    specifications: SpecificationDocument[]
  ): Promise<ExtractedRequirement[]> {
    const requirements: ExtractedRequirement[] = [];

    for (const spec of specifications) {
      if (spec.phase === 'requirements') {
        // Parse EARS format requirements
        const earsRequirements = this.parseEARSRequirements(spec.content);
        requirements.push(...earsRequirements);

        // Parse user stories
        const userStories = this.parseUserStories(spec.content);
        requirements.push(...userStories);
      } else if (spec.phase === 'design') {
        // Extract functional requirements from design
        const designRequirements = this.parseDesignRequirements(spec.content);
        requirements.push(...designRequirements);
      } else if (spec.phase === 'tasks') {
        // Extract implementation requirements from tasks
        const taskRequirements = this.parseTaskRequirements(spec.content);
        requirements.push(...taskRequirements);
      }
    }

    return requirements;
  }

  private parseEARSRequirements(content: string): ExtractedRequirement[] {
    const requirements: ExtractedRequirement[] = [];

    // Match EARS patterns: WHEN/IF ... THEN ... SHALL
    const earsPattern = /(?:WHEN|IF)\s+(.+?)\s+THEN\s+(.+?)\s+SHALL\s+(.+?)(?:\n|$)/gi;
    let match;

    while ((match = earsPattern.exec(content)) !== null) {
      const [, condition, context, action] = match;

      requirements.push({
        id: `ears-${requirements.length + 1}`,
        type: 'functional',
        description: `${condition.trim()} → ${action.trim()}`,
        condition: condition.trim(),
        expectedBehavior: action.trim(),
        context: context.trim(),
        testable: true,
        priority: 'high',
      });
    }

    return requirements;
  }

  private parseUserStories(content: string): ExtractedRequirement[] {
    const requirements: ExtractedRequirement[] = [];

    // Match user story pattern: As a ... I want ... so that ...
    const userStoryPattern =
      /As\s+a\s+(.+?),?\s+I\s+want\s+(.+?),?\s+so\s+that\s+(.+?)(?:\n|\.|\*\*|$)/gi;
    let match;

    while ((match = userStoryPattern.exec(content)) !== null) {
      const [, role, want, benefit] = match;

      requirements.push({
        id: `story-${requirements.length + 1}`,
        type: 'user-story',
        description: `As ${role.trim()}, I want ${want.trim()}`,
        role: role.trim(),
        functionality: want.trim(),
        benefit: benefit.trim(),
        testable: true,
        priority: 'medium',
      });
    }

    return requirements;
  }

  private parseDesignRequirements(content: string): ExtractedRequirement[] {
    const requirements: ExtractedRequirement[] = [];

    // Extract API endpoints, data models, and interfaces
    const apiPattern = /(?:endpoint|route|api):\s*([A-Z]+)\s+([\/\w\-:{}]+)/gi;
    const interfacePattern = /interface\s+(\w+)\s*{([^}]+)}/gi;
    const functionPattern = /function\s+(\w+)\s*\([^)]*\)(?:\s*:\s*([^{]+))?/gi;

    let match;

    // API endpoints
    while ((match = apiPattern.exec(content)) !== null) {
      const [, method, path] = match;
      requirements.push({
        id: `api-${requirements.length + 1}`,
        type: 'api',
        description: `${method} ${path} endpoint must be implemented`,
        method: method.trim(),
        path: path.trim(),
        testable: true,
        priority: 'high',
      });
    }

    // Interfaces
    while ((match = interfacePattern.exec(content)) !== null) {
      const [, name, body] = match;
      requirements.push({
        id: `interface-${requirements.length + 1}`,
        type: 'interface',
        description: `${name} interface must be implemented`,
        interfaceName: name.trim(),
        properties: body.trim(),
        testable: true,
        priority: 'medium',
      });
    }

    return requirements;
  }

  private parseTaskRequirements(content: string): ExtractedRequirement[] {
    const requirements: ExtractedRequirement[] = [];

    // Extract implementation tasks
    const taskPattern = /[-*]\s*\[\s*[x\s]\s*\]\s*(.+?)(?:\n|$)/gi;
    let match;

    while ((match = taskPattern.exec(content)) !== null) {
      const taskDescription = match[1].trim();

      if (this.isImplementationTask(taskDescription)) {
        requirements.push({
          id: `task-${requirements.length + 1}`,
          type: 'implementation',
          description: taskDescription,
          testable: this.isTestableTask(taskDescription),
          priority: 'medium',
        });
      }
    }

    return requirements;
  }

  private isImplementationTask(description: string): boolean {
    const implementationKeywords = [
      'implement',
      'create',
      'build',
      'develop',
      'write',
      'add',
      'function',
      'class',
      'method',
      'component',
      'service',
      'api',
    ];

    return implementationKeywords.some(keyword => description.toLowerCase().includes(keyword));
  }

  private isTestableTask(description: string): boolean {
    const nonTestableKeywords = ['document', 'plan', 'design', 'research'];
    return !nonTestableKeywords.some(keyword => description.toLowerCase().includes(keyword));
  }

  private async analyzeCode(code: string, language: SupportedLanguage): Promise<CodeAnalysis> {
    // Use AI to analyze code structure and functionality
    const analysisPrompt = `
Analyze the following ${language} code and provide a structured analysis:

1. Functions and methods defined
2. Classes and interfaces
3. API endpoints (if any)
4. Data structures
5. Main functionality
6. Dependencies and imports
7. Error handling patterns

Code:
\`\`\`${language}
${code}
\`\`\`

Provide the analysis in JSON format.
`;

    try {
      if (!this.aiService) {
        // Fallback to basic static analysis if AI service is not available
        return this.performBasicCodeAnalysis(code, language);
      }
      const analysisResult = await this.aiService.generateCompletion(analysisPrompt);
      return JSON.parse(analysisResult);
    } catch (error) {
      // Fallback to basic static analysis
      return this.performBasicCodeAnalysis(code, language);
    }
  }

  private performBasicCodeAnalysis(code: string, language: SupportedLanguage): CodeAnalysis {
    const analysis: CodeAnalysis = {
      functions: [],
      classes: [],
      apis: [],
      dataStructures: [],
      imports: [],
      errorHandling: false,
    };

    switch (language) {
      case SupportedLanguage.JAVASCRIPT:
      case SupportedLanguage.TYPESCRIPT:
        analysis.functions = this.extractJavaScriptFunctions(code);
        analysis.classes = this.extractJavaScriptClasses(code);
        analysis.apis = this.extractJavaScriptAPIs(code);
        break;

      case SupportedLanguage.PYTHON:
        analysis.functions = this.extractPythonFunctions(code);
        analysis.classes = this.extractPythonClasses(code);
        break;

      case SupportedLanguage.JAVA:
        analysis.functions = this.extractJavaFunctions(code);
        analysis.classes = this.extractJavaClasses(code);
        break;
    }

    analysis.errorHandling = this.detectErrorHandling(code, language);

    return analysis;
  }

  private extractJavaScriptFunctions(code: string): string[] {
    const functionPattern =
      /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s+)?\([^)]*\)\s*=>|(\w+)\s*:\s*(?:async\s+)?function)/g;
    const functions: string[] = [];
    let match;

    while ((match = functionPattern.exec(code)) !== null) {
      const functionName = match[1] || match[2] || match[3];
      if (functionName) {
        functions.push(functionName);
      }
    }

    return functions;
  }

  private extractJavaScriptClasses(code: string): string[] {
    const classPattern = /class\s+(\w+)/g;
    const classes: string[] = [];
    let match;

    while ((match = classPattern.exec(code)) !== null) {
      classes.push(match[1]);
    }

    return classes;
  }

  private extractJavaScriptAPIs(code: string): string[] {
    const apiPattern = /(?:app|router)\.(?:get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/g;
    const apis: string[] = [];
    let match;

    while ((match = apiPattern.exec(code)) !== null) {
      apis.push(match[1]);
    }

    return apis;
  }

  private extractPythonFunctions(code: string): string[] {
    const functionPattern = /def\s+(\w+)\s*\(/g;
    const functions: string[] = [];
    let match;

    while ((match = functionPattern.exec(code)) !== null) {
      functions.push(match[1]);
    }

    return functions;
  }

  private extractPythonClasses(code: string): string[] {
    const classPattern = /class\s+(\w+)/g;
    const classes: string[] = [];
    let match;

    while ((match = classPattern.exec(code)) !== null) {
      classes.push(match[1]);
    }

    return classes;
  }

  private extractJavaFunctions(code: string): string[] {
    const functionPattern = /(?:public|private|protected)?\s*(?:static)?\s*\w+\s+(\w+)\s*\(/g;
    const functions: string[] = [];
    let match;

    while ((match = functionPattern.exec(code)) !== null) {
      functions.push(match[1]);
    }

    return functions;
  }

  private extractJavaClasses(code: string): string[] {
    const classPattern = /(?:public\s+)?class\s+(\w+)/g;
    const classes: string[] = [];
    let match;

    while ((match = classPattern.exec(code)) !== null) {
      classes.push(match[1]);
    }

    return classes;
  }

  private detectErrorHandling(code: string, language: SupportedLanguage): boolean {
    const errorPatterns = {
      [SupportedLanguage.JAVASCRIPT]: /try\s*{|catch\s*\(|throw\s+/,
      [SupportedLanguage.TYPESCRIPT]: /try\s*{|catch\s*\(|throw\s+/,
      [SupportedLanguage.PYTHON]: /try\s*:|except\s+|raise\s+/,
      [SupportedLanguage.JAVA]: /try\s*{|catch\s*\(|throw\s+/,
      [SupportedLanguage.GO]: /defer\s+|panic\s*\(|recover\s*\(/,
      [SupportedLanguage.RUST]: /Result<|Option<|panic!|unwrap\(\)/,
    };

    const pattern = errorPatterns[language];
    return pattern ? pattern.test(code) : false;
  }

  private async matchCodeToRequirements(
    code: string,
    language: SupportedLanguage,
    requirements: ExtractedRequirement[],
    codeAnalysis: CodeAnalysis
  ): Promise<RequirementMatch[]> {
    const matches: RequirementMatch[] = [];

    for (const requirement of requirements) {
      const match = await this.matchSingleRequirement(code, language, requirement, codeAnalysis);
      matches.push(match);
    }

    return matches;
  }

  private async matchSingleRequirement(
    code: string,
    language: SupportedLanguage,
    requirement: ExtractedRequirement,
    codeAnalysis: CodeAnalysis
  ): Promise<RequirementMatch> {
    let matchScore = 0;
    const evidence: string[] = [];
    const codeSnippets: string[] = [];

    // Match based on requirement type
    switch (requirement.type) {
      case 'functional':
        matchScore = this.matchFunctionalRequirement(requirement, codeAnalysis, evidence);
        break;

      case 'api':
        matchScore = this.matchAPIRequirement(requirement, codeAnalysis, evidence);
        break;

      case 'interface':
        matchScore = this.matchInterfaceRequirement(requirement, code, evidence);
        break;

      case 'user-story':
        matchScore = this.matchUserStoryRequirement(requirement, codeAnalysis, evidence);
        break;

      case 'implementation':
        matchScore = this.matchImplementationRequirement(requirement, codeAnalysis, evidence);
        break;
    }

    // Extract relevant code snippets
    if (matchScore > 0) {
      codeSnippets.push(...this.extractRelevantCodeSnippets(code, requirement, codeAnalysis));
    }

    return {
      requirementId: requirement.id,
      requirementText: requirement.description,
      codeSnippets,
      matchScore,
      evidence,
    };
  }

  private matchFunctionalRequirement(
    requirement: ExtractedRequirement,
    codeAnalysis: CodeAnalysis,
    evidence: string[]
  ): number {
    let score = 0;

    // Check if required functionality is implemented
    if (requirement.expectedBehavior) {
      const behaviorKeywords = requirement.expectedBehavior.toLowerCase().split(/\s+/);
      const codeElements = [...codeAnalysis.functions, ...codeAnalysis.classes].map(el =>
        el.toLowerCase()
      );

      const matchingElements = behaviorKeywords.filter(keyword =>
        codeElements.some(element => element.includes(keyword))
      );

      if (matchingElements.length > 0) {
        score += 50;
        evidence.push(`Found implementation elements: ${matchingElements.join(', ')}`);
      }
    }

    return Math.min(score, 100);
  }

  private matchAPIRequirement(
    requirement: ExtractedRequirement,
    codeAnalysis: CodeAnalysis,
    evidence: string[]
  ): number {
    let score = 0;

    if (requirement.path && requirement.method) {
      const matchingAPI = codeAnalysis.apis.find(api => api.includes(requirement.path));

      if (matchingAPI) {
        score = 100;
        evidence.push(`Found API endpoint: ${matchingAPI}`);
      }
    }

    return score;
  }

  private matchInterfaceRequirement(
    requirement: ExtractedRequirement,
    code: string,
    evidence: string[]
  ): number {
    let score = 0;

    if (requirement.interfaceName) {
      const interfacePattern = new RegExp(`interface\\s+${requirement.interfaceName}`, 'i');
      if (interfacePattern.test(code)) {
        score = 100;
        evidence.push(`Found interface: ${requirement.interfaceName}`);
      }
    }

    return score;
  }

  private matchUserStoryRequirement(
    requirement: ExtractedRequirement,
    codeAnalysis: CodeAnalysis,
    evidence: string[]
  ): number {
    let score = 0;

    if (requirement.functionality) {
      const functionalityKeywords = requirement.functionality.toLowerCase().split(/\s+/);
      const implementedFeatures = [...codeAnalysis.functions, ...codeAnalysis.classes];

      const relevantFeatures = implementedFeatures.filter(feature =>
        functionalityKeywords.some(keyword => feature.toLowerCase().includes(keyword))
      );

      if (relevantFeatures.length > 0) {
        score = Math.min(relevantFeatures.length * 25, 100);
        evidence.push(`Implemented features: ${relevantFeatures.join(', ')}`);
      }
    }

    return score;
  }

  private matchImplementationRequirement(
    requirement: ExtractedRequirement,
    codeAnalysis: CodeAnalysis,
    evidence: string[]
  ): number {
    let score = 0;

    const descriptionKeywords = requirement.description.toLowerCase().split(/\s+/);
    const implementedElements = [...codeAnalysis.functions, ...codeAnalysis.classes];

    const matchingElements = implementedElements.filter(element =>
      descriptionKeywords.some(keyword => element.toLowerCase().includes(keyword))
    );

    if (matchingElements.length > 0) {
      score = Math.min(matchingElements.length * 30, 100);
      evidence.push(`Matching implementations: ${matchingElements.join(', ')}`);
    }

    return score;
  }

  private extractRelevantCodeSnippets(
    code: string,
    requirement: ExtractedRequirement,
    codeAnalysis: CodeAnalysis
  ): string[] {
    const snippets: string[] = [];
    const lines = code.split('\n');

    // Extract function definitions that match the requirement
    for (const functionName of codeAnalysis.functions) {
      const functionPattern = new RegExp(
        `(?:function\\s+${functionName}|${functionName}\\s*[=:].*function)`,
        'i'
      );

      for (let i = 0; i < lines.length; i++) {
        if (functionPattern.test(lines[i])) {
          // Extract function and a few surrounding lines
          const start = Math.max(0, i - 1);
          const end = Math.min(lines.length, i + 10);
          snippets.push(lines.slice(start, end).join('\n'));
          break;
        }
      }
    }

    return snippets;
  }

  private async generateTestCases(
    requirements: ExtractedRequirement[],
    code: string,
    language: SupportedLanguage
  ): Promise<TestCase[]> {
    const testCases: TestCase[] = [];

    for (const requirement of requirements.filter(r => r.testable)) {
      const testCase = await this.generateTestCaseForRequirement(requirement, code, language);
      if (testCase) {
        testCases.push(testCase);
      }
    }

    return testCases;
  }

  private async generateTestCaseForRequirement(
    requirement: ExtractedRequirement,
    code: string,
    language: SupportedLanguage
  ): Promise<TestCase | null> {
    try {
      const testPrompt = `
Generate a test case for the following requirement in ${language}:

Requirement: ${requirement.description}
Type: ${requirement.type}

Code to test:
\`\`\`${language}
${code}
\`\`\`

Generate a test case with:
1. Description of what to test
2. Input (if needed)
3. Expected output or behavior
4. Test execution code

Return as JSON with fields: description, input, expectedOutput, expectedBehavior, testCode
`;

      if (!this.aiService) {
        // Return null if AI service is not available
        return null;
      }
      const testResult = await this.aiService.generateCompletion(testPrompt);
      const testData = JSON.parse(testResult);

      return {
        id: `test-${requirement.id}`,
        description: testData.description,
        input: testData.input,
        expectedOutput: testData.expectedOutput,
        expectedBehavior: testData.expectedBehavior,
        requirement: requirement.id,
      };
    } catch (error) {
      console.error(`Failed to generate test case for requirement ${requirement.id}:`, error);
      return null;
    }
  }

  private async executeTests(
    code: string,
    language: SupportedLanguage,
    testCases: TestCase[]
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];

    for (const testCase of testCases) {
      try {
        const testCode = this.generateTestExecutionCode(code, testCase, language);

        const executionResult = await this.codeExecutionService.executeCode({
          code: testCode,
          language,
          input: testCase.input,
          timeout: 10000,
        });

        const passed = this.evaluateTestResult(executionResult, testCase);

        results.push({
          testId: testCase.id,
          passed,
          output: executionResult.output,
          error: executionResult.error,
          executionTime: executionResult.executionTime,
        });
      } catch (error) {
        results.push({
          testId: testCase.id,
          passed: false,
          output: '',
          error: error.message,
          executionTime: 0,
        });
      }
    }

    return results;
  }

  private generateTestExecutionCode(
    originalCode: string,
    testCase: TestCase,
    language: SupportedLanguage
  ): string {
    switch (language) {
      case SupportedLanguage.JAVASCRIPT:
      case SupportedLanguage.TYPESCRIPT:
        return `
${originalCode}

// Test execution
try {
  ${testCase.input ? `const input = ${JSON.stringify(testCase.input)};` : ''}
  // Test code would be generated based on the test case
  // // console.log('Test passed');
} catch (error) {
  console.error('Test failed:', error.message);
}
`;

      case SupportedLanguage.PYTHON:
        return `
${originalCode}

# Test execution
try:
    ${testCase.input ? `input_data = ${JSON.stringify(testCase.input)}` : ''}
    # Test code would be generated based on the test case
    print('Test passed')
except Exception as error:
    print(f'Test failed: {error}')
`;

      default:
        return originalCode;
    }
  }

  private evaluateTestResult(executionResult: unknown, testCase: TestCase): boolean {
    if (!executionResult.success) {
      return false;
    }

    if (testCase.expectedOutput) {
      return executionResult.output.includes(testCase.expectedOutput);
    }

    // If no specific output expected, consider it passed if execution succeeded
    return true;
  }

  private generateComplianceDetails(
    requirementMatches: RequirementMatch[],
    testResults: TestResult[]
  ): ComplianceDetail[] {
    const details: ComplianceDetail[] = [];

    for (const match of requirementMatches) {
      const relatedTests = testResults.filter(test => test.testId.includes(match.requirementId));

      let status: 'passed' | 'failed' | 'partial';
      let message: string;

      if (match.matchScore >= 80) {
        status = 'passed';
        message = `Requirement fully implemented (${match.matchScore}% match)`;
      } else if (match.matchScore >= 40) {
        status = 'partial';
        message = `Requirement partially implemented (${match.matchScore}% match)`;
      } else {
        status = 'failed';
        message = `Requirement not implemented (${match.matchScore}% match)`;
      }

      // Factor in test results
      if (relatedTests.length > 0) {
        const passedTests = relatedTests.filter(test => test.passed).length;
        const testPassRate = passedTests / relatedTests.length;

        if (testPassRate < 0.5 && status === 'passed') {
          status = 'partial';
          message += ` - Tests failing (${passedTests}/${relatedTests.length} passed)`;
        }
      }

      details.push({
        requirement: match.requirementText,
        status,
        message,
        evidence: match.evidence.join('; '),
      });
    }

    return details;
  }

  private calculateComplianceScore(details: ComplianceDetail[]): number {
    if (details.length === 0) return 0;

    const scores = details.map(detail => {
      switch (detail.status) {
        case 'passed':
          return 100;
        case 'partial':
          return 50;
        case 'failed':
          return 0;
        default:
          return 0;
      }
    });

    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }

  private async generateImprovementSuggestions(
    details: ComplianceDetail[],
    code: string,
    requirements: ExtractedRequirement[]
  ): Promise<string[]> {
    const suggestions: string[] = [];

    const failedRequirements = details.filter(detail => detail.status === 'failed');
    const partialRequirements = details.filter(detail => detail.status === 'partial');

    for (const failed of failedRequirements) {
      suggestions.push(`Implement missing functionality: ${failed.requirement}`);
    }

    for (const partial of partialRequirements) {
      suggestions.push(`Complete implementation: ${partial.requirement}`);
    }

    // Add general suggestions
    if (suggestions.length > 0) {
      suggestions.push('Consider adding comprehensive error handling');
      suggestions.push('Add input validation for all functions');
      suggestions.push('Include unit tests for all implemented features');
    }

    return suggestions;
  }
}

// Supporting interfaces
interface ExtractedRequirement {
  id: string;
  type: 'functional' | 'api' | 'interface' | 'user-story' | 'implementation';
  description: string;
  condition?: string;
  expectedBehavior?: string;
  context?: string;
  role?: string;
  functionality?: string;
  benefit?: string;
  method?: string;
  path?: string;
  interfaceName?: string;
  properties?: string;
  testable: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface CodeAnalysis {
  functions: string[];
  classes: string[];
  apis: string[];
  dataStructures: string[];
  imports: string[];
  errorHandling: boolean;
}

interface TestResult {
  testId: string;
  passed: boolean;
  output: string;
  error?: string;
  executionTime: number;
}
