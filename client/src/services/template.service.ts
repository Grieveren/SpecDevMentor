import { typedApiClient } from './api.service';

export interface TemplateVariable {
  name: string;
  description: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  required: boolean;
  defaultValue?: string;
  options?: string[];
}

export interface Template {
  id: string;
  name: string;
  description: string;
  phase?: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  category: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'GENERAL' | 'DOMAIN_SPECIFIC';
  content: string;
  variables: TemplateVariable[];
  tags: string[];
  isPublic: boolean;
  isOfficial: boolean;
  usageCount: number;
  rating: number;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  _count: {
    usages: number;
  };
}

export interface CreateTemplateRequest {
  name: string;
  description: string;
  phase?: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  category: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'GENERAL' | 'DOMAIN_SPECIFIC';
  content: string;
  variables?: TemplateVariable[];
  tags?: string[];
  isPublic?: boolean;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {}

export interface SearchTemplatesRequest {
  query?: string;
  phase?: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'IMPLEMENTATION';
  category?: 'REQUIREMENTS' | 'DESIGN' | 'TASKS' | 'GENERAL' | 'DOMAIN_SPECIFIC';
  tags?: string[];
  authorId?: string;
  isPublic?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'createdAt' | 'usageCount' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedTemplates {
  templates: Template[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApplyTemplateRequest {
  templateId: string;
  variables: Record<string, string>;
  projectId?: string;
}

export interface ShareTemplateRequest {
  projectId: string;
  permission?: 'read' | 'write' | 'admin';
}

export interface RateTemplateRequest {
  rating: number;
  feedback?: string;
}

export class TemplateService {
  async createTemplate(data: CreateTemplateRequest): Promise<Template> {
    const response = await typedApiClient.post<{ data: Template }>('/templates', data);
    return response.data.data;
  }

  async updateTemplate(templateId: string, data: UpdateTemplateRequest): Promise<Template> {
    const response = await typedApiClient.put<{ data: Template }>(`/templates/${templateId}`, data);
    return response.data.data;
  }

  async deleteTemplate(templateId: string): Promise<void> {
    await typedApiClient.delete(`/templates/${templateId}`);
  }

  async getTemplate(templateId: string): Promise<Template> {
    const response = await typedApiClient.get<{ data: Template }>(`/templates/${templateId}`);
    return response.data.data;
  }

  async searchTemplates(params: SearchTemplatesRequest = {}): Promise<PaginatedTemplates> {
    const response = await typedApiClient.get<{ data: PaginatedTemplates }>('/templates', { params });
    return response.data.data;
  }

  async applyTemplate(request: ApplyTemplateRequest): Promise<string> {
    const response = await typedApiClient.post<{ data: { content: string } }>('/templates/apply', request);
    return response.data.data.content;
  }

  async shareTemplateWithTeam(
    templateId: string,
    data: ShareTemplateRequest
  ): Promise<void> {
    await typedApiClient.post(`/templates/${templateId}/share`, data);
  }

  async rateTemplate(templateId: string, data: RateTemplateRequest): Promise<void> {
    await typedApiClient.post(`/templates/${templateId}/rate`, data);
  }

  async getTemplatesByProject(projectId: string): Promise<Template[]> {
    const response = await typedApiClient.get<{ data: Template[] }>(`/templates/project/${projectId}`);
    return response.data.data;
  }
}

export const templateService = new TemplateService();