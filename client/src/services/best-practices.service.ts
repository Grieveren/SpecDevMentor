import { apiClient } from './api.service';

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

export interface BestPracticeGuide {
  id: string;
  title: string;
  description: string;
  phase: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  content: string;
  tips: InteractiveTip[];
  examples: Example[];
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface ContextualGuidance {
  tips: InteractiveTip[];
  examples: Example[];
  recommendations: string[];
}

export interface QualityAnalysis {
  score: number;
  issues: Array<{
    type: 'error' | 'warning' | 'suggestion';
    message: string;
    line?: number;
    suggestion?: string;
  }>;
  improvements: string[];
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

export interface GetGuidanceRequest {
  phase: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  content: string;
  context?: string;
}

export interface AnalyzeQualityRequest {
  phase: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  content: string;
}

export class BestPracticesService {
  async createGuide(_data: CreateGuideRequest): Promise<BestPracticeGuide> {
    const _response = await apiClient.post('/best-practices', data);
    return response.data.data;
  }

  async updateGuide(guideId: string, _data: UpdateGuideRequest): Promise<BestPracticeGuide> {
    const _response = await apiClient.put(`/best-practices/${guideId}`, data);
    return response.data.data;
  }

  async deleteGuide(guideId: string): Promise<void> {
    await apiClient.delete(`/best-practices/${guideId}`);
  }

  async getGuide(guideId: string): Promise<BestPracticeGuide> {
    const _response = await apiClient.get(`/best-practices/${guideId}`);
    return response.data.data;
  }

  async getAllGuides(): Promise<BestPracticeGuide[]> {
    const _response = await apiClient.get('/best-practices');
    return response.data.data;
  }

  async getGuidesByPhase(phase: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION'): Promise<BestPracticeGuide[]> {
    const _response = await apiClient.get(`/best-practices/phase/${phase}`);
    return response.data.data;
  }

  async getContextualGuidance(_request: GetGuidanceRequest): Promise<ContextualGuidance> {
    const _response = await apiClient.post('/best-practices/guidance', request);
    return response.data.data;
  }

  async analyzeDocumentQuality(_request: AnalyzeQualityRequest): Promise<QualityAnalysis> {
    const _response = await apiClient.post('/best-practices/analyze', request);
    return response.data.data;
  }
}

export const bestPracticesService = new BestPracticesService();