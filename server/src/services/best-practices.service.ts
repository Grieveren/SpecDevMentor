import { PrismaClient, BestPracticeGuide, SpecificationPhase } from '@prisma/client';
import { z } from 'zod';

// Validation schemas
const createGuideSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  phase: z.enum(['REQUIREMENTS', 'DESIGN', 'TASKS', 'IMPLEMENTATION']),
  content: z.string().min(1),
  tips: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    type: z.enum(['tip', 'warning', 'best-practice', 'example']),
    trigger: z.object({
      keywords: z.array(z.string()).optional(),
      patterns: z.array(z.string()).optional(),
      context: z.string().optional(),
    }).optional(),
  })).default([]),
  examples: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    goodExample: z.string().optional(),
    badExample: z.string().optional(),
    explanation: z.string(),
  })).default([]),
  isActive: z.boolean().default(true),
  priority: z.number().default(0),
});

const updateGuideSchema = createGuideSchema.partial();

export interface InteractiveTip {
  id: string;
  title: string;
  description: string;
  type: 'tip' | 'warning' | 'best-practice' | 'example';
  trigger?: {
    keywords?: string[];
    patterns?: string[];
    context?: string;
  };
}

export interface Example {
  id: string;
  title: string;
  description: string;
  goodExample?: string;
  badExample?: string;
  explanation: string;
}

export interface CreateGuideRequest {
  title: string;
  description: string;
  phase: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  content: string;
  tips?: InteractiveTip[];
  examples?: Example[];
  isActive?: boolean;
  priority?: number;
}

export interface UpdateGuideRequest extends Partial<CreateGuideRequest> {}

export interface GuideWithDetails extends BestPracticeGuide {
  tips: InteractiveTip[];
  examples: Example[];
}

export interface ContextualGuidance {
  tips: InteractiveTip[];
  examples: Example[];
  recommendations: string[];
}

export class BestPracticesService {
  constructor(private prisma: PrismaClient) {}

  async createGuide(_data: CreateGuideRequest): Promise<BestPracticeGuide> {
    const validatedData = createGuideSchema.parse(_data);

    const guide = await this.prisma.bestPracticeGuide.create({
      data: {
        ...validatedData,
        tips: validatedData.tips,
        examples: validatedData.examples,
      },
    });

    return guide;
  }

  async updateGuide(guideId: string, _data: UpdateGuideRequest): Promise<BestPracticeGuide> {
    const validatedData = updateGuideSchema.parse(_data);

    const guide = await this.prisma.bestPracticeGuide.update({
      where: { id: guideId },
      data: validatedData,
    });

    return guide;
  }

  async deleteGuide(guideId: string): Promise<void> {
    await this.prisma.bestPracticeGuide.delete({
      where: { id: guideId },
    });
  }

  async getGuide(guideId: string): Promise<GuideWithDetails | null> {
    const guide = await this.prisma.bestPracticeGuide.findUnique({
      where: { id: guideId },
    });

    if (!guide) {
      return null;
    }

    return {
      ...guide,
      tips: guide.tips as InteractiveTip[],
      examples: guide.examples as Example[],
    };
  }

  async getGuidesByPhase(phase: SpecificationPhase): Promise<GuideWithDetails[]> {
    const guides = await this.prisma.bestPracticeGuide.findMany({
      where: {
        phase,
        isActive: true,
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return guides.map(guide => ({
      ...guide,
      tips: guide.tips as InteractiveTip[],
      examples: guide.examples as Example[],
    }));
  }

  async getAllGuides(): Promise<GuideWithDetails[]> {
    const guides = await this.prisma.bestPracticeGuide.findMany({
      where: { isActive: true },
      orderBy: [
        { phase: 'asc' },
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });

    return guides.map(guide => ({
      ...guide,
      tips: guide.tips as InteractiveTip[],
      examples: guide.examples as Example[],
    }));
  }

  async getContextualGuidance(
    phase: SpecificationPhase,
    content: string,
    context?: string
  ): Promise<ContextualGuidance> {
    const guides = await this.getGuidesByPhase(phase);
    
    const relevantTips: InteractiveTip[] = [];
    const relevantExamples: Example[] = [];
    const recommendations: string[] = [];

    for (const guide of guides) {
      // Check tips for relevance
      for (const tip of guide.tips) {
        if (this.isTipRelevant(tip, content, context)) {
          relevantTips.push(tip);
        }
      }

      // Check examples for relevance
      for (const example of guide.examples) {
        if (this.isExampleRelevant(example, content, context)) {
          relevantExamples.push(example);
        }
      }

      // Generate recommendations based on content analysis
      const contentRecommendations = this.analyzeContentForRecommendations(
        guide,
        content,
        phase
      );
      recommendations.push(...contentRecommendations);
    }

    return {
      tips: relevantTips.slice(0, 5), // Limit to top 5 most relevant tips
      examples: relevantExamples.slice(0, 3), // Limit to top 3 examples
      recommendations: recommendations.slice(0, 5), // Limit to top 5 recommendations
    };
  }

  async analyzeDocumentQuality(
    phase: SpecificationPhase,
    content: string
  ): Promise<{
    score: number;
    issues: Array<{
      type: 'error' | 'warning' | 'suggestion';
      message: string;
      line?: number;
      suggestion?: string;
    }>;
    improvements: string[];
  }> {
    const guides = await this.getGuidesByPhase(phase);
    const issues: Array<{
      type: 'error' | 'warning' | 'suggestion';
      message: string;
      line?: number;
      suggestion?: string;
    }> = [];
    const improvements: string[] = [];
    let score = 100;

    // Analyze content based on phase-specific best practices
    switch (phase) {
      case 'REQUIREMENTS':
        this.analyzeRequirementsQuality(content, guides, issues, improvements);
        break;
      case 'DESIGN':
        this.analyzeDesignQuality(content, guides, issues, improvements);
        break;
      case 'TASKS':
        this.analyzeTasksQuality(content, guides, issues, improvements);
        break;
      case 'IMPLEMENTATION':
        this.analyzeImplementationQuality(content, guides, issues, improvements);
        break;
    }

    // Calculate score based on issues
    score -= issues.filter(i => i.type === 'error').length * 20;
    score -= issues.filter(i => i.type === 'warning').length * 10;
    score -= issues.filter(i => i.type === 'suggestion').length * 5;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      issues,
      improvements,
    };
  }

  private isTipRelevant(tip: InteractiveTip, content: string, context?: string): boolean {
    if (!tip.trigger) {
      return true; // Always show tips without triggers
    }

    const lowerContent = content.toLowerCase();
    const lowerContext = context?.toLowerCase() || '';

    // Check keywords
    if (tip.trigger.keywords) {
      const hasKeyword = tip.trigger.keywords.some(keyword =>
        lowerContent.includes(keyword.toLowerCase()) ||
        lowerContext.includes(keyword.toLowerCase())
      );
      if (hasKeyword) return true;
    }

    // Check patterns (simple regex matching)
    if (tip.trigger.patterns) {
      const hasPattern = tip.trigger.patterns.some(pattern => {
        try {
          const regex = new RegExp(pattern, 'i');
          return regex.test(content) || regex.test(context || '');
        } catch {
          return false;
        }
      });
      if (hasPattern) return true;
    }

    // Check context
    if (tip.trigger.context && context) {
      return lowerContext.includes(tip.trigger.context.toLowerCase());
    }

    return false;
  }

  private isExampleRelevant(example: Example, content: string, context?: string): boolean {
    const lowerContent = content.toLowerCase();
    const lowerTitle = example.title.toLowerCase();
    const lowerDescription = example.description.toLowerCase();

    // Simple relevance check based on title and description keywords
    const keywords = [...lowerTitle.split(' '), ...lowerDescription.split(' ')];
    return keywords.some(keyword => 
      keyword.length > 3 && lowerContent.includes(keyword)
    );
  }

  private analyzeContentForRecommendations(
    guide: GuideWithDetails,
    content: string,
    phase: SpecificationPhase
  ): string[] {
    const recommendations: string[] = [];
    const lowerContent = content.toLowerCase();

    // Phase-specific analysis
    switch (phase) {
      case 'REQUIREMENTS':
        if (!lowerContent.includes('user story') && !lowerContent.includes('as a')) {
          recommendations.push('Consider adding user stories to better capture user needs');
        }
        if (!lowerContent.includes('acceptance criteria')) {
          recommendations.push('Add acceptance criteria to make requirements testable');
        }
        if (!lowerContent.includes('when') && !lowerContent.includes('then')) {
          recommendations.push('Use EARS format (WHEN/IF/THEN) for clearer requirements');
        }
        break;

      case 'DESIGN':
        if (!lowerContent.includes('architecture') && !lowerContent.includes('component')) {
          recommendations.push('Include architectural overview and component descriptions');
        }
        if (!lowerContent.includes('data model') && !lowerContent.includes('database')) {
          recommendations.push('Define data models and database schema');
        }
        if (!lowerContent.includes('api') && !lowerContent.includes('interface')) {
          recommendations.push('Specify API interfaces and contracts');
        }
        break;

      case 'TASKS':
        if (!lowerContent.includes('test') && !lowerContent.includes('testing')) {
          recommendations.push('Include testing tasks for quality assurance');
        }
        if (content.split('\n').filter(line => line.trim().startsWith('-')).length < 3) {
          recommendations.push('Break down work into smaller, manageable tasks');
        }
        break;

      case 'IMPLEMENTATION':
        if (!lowerContent.includes('code review') && !lowerContent.includes('review')) {
          recommendations.push('Include code review process in implementation');
        }
        break;
    }

    return recommendations;
  }

  private analyzeRequirementsQuality(
    content: string,
    guides: GuideWithDetails[],
    issues: Array<{ type: 'error' | 'warning' | 'suggestion'; message: string; line?: number; suggestion?: string; }>,
    improvements: string[]
  ): void {
    const lines = content.split('\n');
    
    // Check for user stories format
    let hasUserStories = false;
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes('as a') && line.toLowerCase().includes('i want')) {
        hasUserStories = true;
      }
      
      // Check for vague language
      const vagueWords = ['should', 'might', 'could', 'probably', 'maybe'];
      vagueWords.forEach(word => {
        if (line.toLowerCase().includes(word)) {
          issues.push({
            type: 'warning',
            message: `Avoid vague language like "${word}" in requirements`,
            line: index + 1,
            suggestion: 'Use definitive language like "shall", "will", or "must"'
          });
        }
      });
    });

    if (!hasUserStories) {
      issues.push({
        type: 'suggestion',
        message: 'Consider adding user stories to capture user needs',
        suggestion: 'Format: "As a [role], I want [feature], so that [benefit]"'
      });
    }

    // Check for EARS format
    const hasEarsFormat = content.toLowerCase().includes('when') && 
                         content.toLowerCase().includes('then');
    if (!hasEarsFormat) {
      improvements.push('Use EARS format (WHEN/IF/THEN) for clearer acceptance criteria');
    }
  }

  private analyzeDesignQuality(
    content: string,
    guides: GuideWithDetails[],
    issues: Array<{ type: 'error' | 'warning' | 'suggestion'; message: string; line?: number; suggestion?: string; }>,
    improvements: string[]
  ): void {
    const lowerContent = content.toLowerCase();

    // Check for essential design sections
    const requiredSections = [
      { name: 'architecture', message: 'Include system architecture overview' },
      { name: 'component', message: 'Define system components and their responsibilities' },
      { name: 'data', message: 'Specify data models and storage design' },
      { name: 'api', message: 'Document API interfaces and contracts' },
    ];

    requiredSections.forEach(section => {
      if (!lowerContent.includes(section.name)) {
        issues.push({
          type: 'suggestion',
          message: section.message,
        });
      }
    });

    // Check for error handling
    if (!lowerContent.includes('error') && !lowerContent.includes('exception')) {
      improvements.push('Include error handling strategy in the design');
    }

    // Check for security considerations
    if (!lowerContent.includes('security') && !lowerContent.includes('authentication')) {
      improvements.push('Consider security aspects and authentication mechanisms');
    }
  }

  private analyzeTasksQuality(
    content: string,
    guides: GuideWithDetails[],
    issues: Array<{ type: 'error' | 'warning' | 'suggestion'; message: string; line?: number; suggestion?: string; }>,
    improvements: string[]
  ): void {
    const lines = content.split('\n');
    const taskLines = lines.filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'));

    if (taskLines.length < 3) {
      issues.push({
        type: 'warning',
        message: 'Consider breaking down work into more specific tasks',
        suggestion: 'Aim for 5-15 manageable tasks per phase'
      });
    }

    // Check for testing tasks
    const hasTestingTasks = taskLines.some(line => 
      line.toLowerCase().includes('test') || 
      line.toLowerCase().includes('testing')
    );

    if (!hasTestingTasks) {
      improvements.push('Include testing tasks to ensure quality');
    }

    // Check for vague task descriptions
    taskLines.forEach((line, index) => {
      const vagueWords = ['implement', 'create', 'build', 'make'];
      vagueWords.forEach(word => {
        if (line.toLowerCase().includes(word) && line.split(' ').length < 5) {
          issues.push({
            type: 'suggestion',
            message: `Task "${line.trim()}" could be more specific`,
            suggestion: 'Include what, how, and acceptance criteria for each task'
          });
        }
      });
    });
  }

  private analyzeImplementationQuality(
    content: string,
    guides: GuideWithDetails[],
    issues: Array<{ type: 'error' | 'warning' | 'suggestion'; message: string; line?: number; suggestion?: string; }>,
    improvements: string[]
  ): void {
    const lowerContent = content.toLowerCase();

    // Check for code review process
    if (!lowerContent.includes('review') && !lowerContent.includes('peer review')) {
      improvements.push('Include code review process in implementation workflow');
    }

    // Check for testing strategy
    if (!lowerContent.includes('test') && !lowerContent.includes('testing')) {
      issues.push({
        type: 'warning',
        message: 'Implementation should include testing strategy',
        suggestion: 'Add unit tests, integration tests, and end-to-end testing'
      });
    }

    // Check for deployment considerations
    if (!lowerContent.includes('deploy') && !lowerContent.includes('deployment')) {
      improvements.push('Consider deployment strategy and environment setup');
    }
  }
}