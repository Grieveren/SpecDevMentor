import {
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectFilters,
  PaginationOptions,
  PaginatedProjects,
  AddTeamMemberRequest,
  ProjectAnalytics,
} from '../types/project';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

interface ApiError {
  success: false;
  message: string;
  code?: string;
  errors?: Array<{ field: string; message: string }>;
}

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

class ProjectService {
  private getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async handleResponse<T>(_response: Response): Promise<T> {
    const _data = await response.json();

    if (!response.ok) {
      const _error = data as ApiError;
      throw new ProjectApiError(
        error.message || 'An error occurred',
        error.code,
        response.status,
        error.errors
      );
    }

    return (data as ApiResponse<T>).data;
  }

  async getProjects(
    filters: ProjectFilters = {},
    pagination: PaginationOptions = { page: 1, limit: 10 }
  ): Promise<PaginatedProjects> {
    const params = new URLSearchParams();
    
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.phase) params.append('phase', filters.phase);
    if (filters.ownerId) params.append('ownerId', filters.ownerId);
    
    params.append('page', pagination.page.toString());
    params.append('limit', pagination.limit.toString());

    const _response = await fetch(`${API_BASE_URL}/projects?${params}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<PaginatedProjects>(response);
  }

  async getProject(id: string): Promise<Project> {
    const _response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<Project>(response);
  }

  async createProject(_data: CreateProjectRequest): Promise<Project> {
    const _response = await fetch(`${API_BASE_URL}/projects`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<Project>(response);
  }

  async updateProject(id: string, _data: UpdateProjectRequest): Promise<Project> {
    const _response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    return this.handleResponse<Project>(response);
  }

  async deleteProject(id: string): Promise<void> {
    const _response = await fetch(`${API_BASE_URL}/projects/${id}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse<void>(response);
  }

  async addTeamMember(projectId: string, _data: AddTeamMemberRequest): Promise<void> {
    const _response = await fetch(`${API_BASE_URL}/projects/${projectId}/team`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    await this.handleResponse<void>(response);
  }

  async removeTeamMember(projectId: string, memberId: string): Promise<void> {
    const _response = await fetch(`${API_BASE_URL}/projects/${projectId}/team/${memberId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    await this.handleResponse<void>(response);
  }

  async getProjectAnalytics(projectId: string): Promise<ProjectAnalytics> {
    const _response = await fetch(`${API_BASE_URL}/projects/${projectId}/analytics`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    return this.handleResponse<ProjectAnalytics>(response);
  }
}

export const projectService = new ProjectService();
export { ProjectApiError };