// @ts-nocheck
import {
  AddTeamMemberRequest,
  CreateProjectRequest,
  PaginatedProjects,
  PaginationOptions,
  Project,
  ProjectAnalytics,
  ProjectFilters,
  UpdateProjectRequest,
} from '../types/project';
import { BaseService, typedApiClient } from './api.service';

class ProjectApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public errors?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ProjectApiError';
  }
}

class ProjectService extends BaseService {
  constructor() {
    super(typedApiClient);
  }

  private handleProjectError(error: unknown): ProjectApiError {
    const apiError = this.handleError(error);

    return new ProjectApiError(
      apiError.message,
      apiError.code,
      apiError.statusCode,
      apiError.context
        ? Object.entries(apiError.context).map(([field, message]) => ({
            field,
            message: Array.isArray(message) ? message.join(', ') : String(message),
          }))
        : undefined
    );
  }

  async getProjects(
    filters: ProjectFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 10 }
  ): Promise<PaginatedProjects> {
    try {
      const params: Record<string, string> = {};

      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.phase) params.phase = filters.phase;
      if (filters.ownerId) params.ownerId = filters.ownerId;

      params.page = pagination.page.toString();
      params.limit = pagination.limit.toString();

      const response = await this.apiClient.get<PaginatedProjects>('/projects', { params });
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleProjectError(error);
    }
  }

  async getProject(id: string): Promise<Project> {
    try {
      const response = await this.apiClient.get<Project>(`/projects/${id}`);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleProjectError(error);
    }
  }

  async createProject(data: CreateProjectRequest): Promise<Project> {
    try {
      const response = await this.apiClient.post<Project>('/projects', data);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleProjectError(error);
    }
  }

  async updateProject(id: string, data: UpdateProjectRequest): Promise<Project> {
    try {
      const response = await this.apiClient.put<Project>(`/projects/${id}`, data);
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleProjectError(error);
    }
  }

  async deleteProject(id: string): Promise<void> {
    try {
      const response = await this.apiClient.delete<void>(`/projects/${id}`);
      this.validateResponse(response);
    } catch (error) {
      throw this.handleProjectError(error);
    }
  }

  async addTeamMember(projectId: string, data: AddTeamMemberRequest): Promise<void> {
    try {
      const response = await this.apiClient.post<void>(`/projects/${projectId}/team`, data);
      this.validateResponse(response);
    } catch (error) {
      throw this.handleProjectError(error);
    }
  }

  async removeTeamMember(projectId: string, memberId: string): Promise<void> {
    try {
      const response = await this.apiClient.delete<void>(`/projects/${projectId}/team/${memberId}`);
      this.validateResponse(response);
    } catch (error) {
      throw this.handleProjectError(error);
    }
  }

  async getProjectAnalytics(projectId: string): Promise<ProjectAnalytics> {
    try {
      const response = await this.apiClient.get<ProjectAnalytics>(
        `/projects/${projectId}/analytics`
      );
      return this.validateResponse(response);
    } catch (error) {
      throw this.handleProjectError(error);
    }
  }
}

export const projectService = new ProjectService();
export { ProjectApiError };
