// @ts-nocheck
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  Project,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectFilters,
  PaginationOptions,
  PaginatedProjects,
  AddTeamMemberRequest,
} from '../types/project';
import { projectService, ProjectApiError } from '../services/project.service';

// Enhanced error handling types
interface ProjectServiceError extends Error {
  error?: string;
  code?: string;
  status?: number;
}

// Loading state management
interface LoadingState {
  projects: boolean;
  currentProject: boolean;
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  teamManagement: boolean;
}

interface ProjectActions {
  // Filter and pagination actions
  setFilters: (filters: ProjectFilters) => void;
  
  // Data loading actions
  loadProjects: (pagination?: PaginationOptions) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  
  // CRUD actions
  createProject: (data: CreateProjectRequest) => Promise<Project>;
  updateProject: (id: string, data: UpdateProjectRequest) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  
  // Team management actions
  addTeamMember: (projectId: string, data: AddTeamMemberRequest) => Promise<void>;
  removeTeamMember: (projectId: string, memberId: string) => Promise<void>;
  
  // State management actions
  clearError: () => void;
  clearCurrentProject: () => void;
}

interface ProjectState {
  // State
  projects: Project[];
  currentProject: Project | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: ProjectFilters;
  loading: LoadingState;
  error: string | null;
}

type ProjectStore = ProjectState & ProjectActions;

export const useProjectStore = create<ProjectStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      projects: [],
      currentProject: null,
      pagination: {
        page: 1,
        limit: 10,
        total: 0,
        pages: 0,
      },
      filters: {},
      loading: {
        projects: false,
        currentProject: false,
        creating: false,
        updating: false,
        deleting: false,
        teamManagement: false,
      },
      error: null,

      // Actions
      setFilters: (filters: ProjectFilters): void => {
        set({ filters }, false, 'setFilters');
      },

      loadProjects: async (pagination?: PaginationOptions): Promise<void> => {
        set(
          (state) => ({
            loading: { ...state.loading, projects: true },
            error: null,
          }),
          false,
          'loadProjects:start'
        );

        try {
          const { filters } = get();
          const paginationOptions: PaginationOptions = pagination || {
            page: get().pagination.page,
            limit: get().pagination.limit,
          };

          const result: PaginatedProjects = await projectService.getProjects(filters, paginationOptions);

          set(
            (state) => ({
              projects: result.projects,
              pagination: result.pagination,
              loading: { ...state.loading, projects: false },
            }),
            false,
            'loadProjects:success'
          );
        } catch (error: unknown) {
          const projectError = error as ProjectServiceError;
          const errorMessage = projectError instanceof ProjectApiError 
            ? projectError.message 
            : projectError.message || 'Failed to load projects';

          set(
            (state) => ({
              loading: { ...state.loading, projects: false },
              error: errorMessage,
            }),
            false,
            'loadProjects:error'
          );
        }
      },

      loadProject: async (id: string): Promise<void> => {
        set(
          (state) => ({
            loading: { ...state.loading, currentProject: true },
            error: null,
          }),
          false,
          'loadProject:start'
        );

        try {
          const project: Project = await projectService.getProject(id);

          set(
            (state) => ({
              currentProject: project,
              loading: { ...state.loading, currentProject: false },
            }),
            false,
            'loadProject:success'
          );
        } catch (error: unknown) {
          const projectError = error as ProjectServiceError;
          const errorMessage = projectError instanceof ProjectApiError 
            ? projectError.message 
            : projectError.message || 'Failed to load project';

          set(
            (state) => ({
              loading: { ...state.loading, currentProject: false },
              error: errorMessage,
            }),
            false,
            'loadProject:error'
          );
        }
      },

      createProject: async (data: CreateProjectRequest): Promise<Project> => {
        set(
          (state) => ({
            loading: { ...state.loading, creating: true },
            error: null,
          }),
          false,
          'createProject:start'
        );

        try {
          const project: Project = await projectService.createProject(data);

          set(
            (state) => ({
              projects: [project, ...state.projects],
              loading: { ...state.loading, creating: false },
            }),
            false,
            'createProject:success'
          );

          return project;
        } catch (error: unknown) {
          const projectError = error as ProjectServiceError;
          const errorMessage = projectError instanceof ProjectApiError 
            ? projectError.message 
            : projectError.message || 'Failed to create project';

          set(
            (state) => ({
              loading: { ...state.loading, creating: false },
              error: errorMessage,
            }),
            false,
            'createProject:error'
          );

          throw error;
        }
      },

      updateProject: async (id: string, data: UpdateProjectRequest): Promise<Project> => {
        set(
          (state) => ({
            loading: { ...state.loading, updating: true },
            error: null,
          }),
          false,
          'updateProject:start'
        );

        try {
          const updatedProject: Project = await projectService.updateProject(id, data);

          set(
            (state) => ({
              projects: state.projects.map((p) => (p.id === id ? updatedProject : p)),
              currentProject: state.currentProject?.id === id ? updatedProject : state.currentProject,
              loading: { ...state.loading, updating: false },
            }),
            false,
            'updateProject:success'
          );

          return updatedProject;
        } catch (error: unknown) {
          const projectError = error as ProjectServiceError;
          const errorMessage = projectError instanceof ProjectApiError 
            ? projectError.message 
            : projectError.message || 'Failed to update project';

          set(
            (state) => ({
              loading: { ...state.loading, updating: false },
              error: errorMessage,
            }),
            false,
            'updateProject:error'
          );

          throw error;
        }
      },

      deleteProject: async (id: string): Promise<void> => {
        set(
          (state) => ({
            loading: { ...state.loading, deleting: true },
            error: null,
          }),
          false,
          'deleteProject:start'
        );

        try {
          await projectService.deleteProject(id);

          set(
            (state) => ({
              projects: state.projects.filter((p) => p.id !== id),
              currentProject: state.currentProject?.id === id ? null : state.currentProject,
              loading: { ...state.loading, deleting: false },
            }),
            false,
            'deleteProject:success'
          );
        } catch (error: unknown) {
          const projectError = error as ProjectServiceError;
          const errorMessage = projectError instanceof ProjectApiError 
            ? projectError.message 
            : projectError.message || 'Failed to delete project';

          set(
            (state) => ({
              loading: { ...state.loading, deleting: false },
              error: errorMessage,
            }),
            false,
            'deleteProject:error'
          );

          throw error;
        }
      },

      addTeamMember: async (projectId: string, data: AddTeamMemberRequest): Promise<void> => {
        set(
          (state) => ({
            loading: { ...state.loading, teamManagement: true },
            error: null,
          }),
          false,
          'addTeamMember:start'
        );

        try {
          await projectService.addTeamMember(projectId, data);

          // Reload the current project to get updated team data
          if (get().currentProject?.id === projectId) {
            await get().loadProject(projectId);
          }

          set(
            (state) => ({
              loading: { ...state.loading, teamManagement: false },
            }),
            false,
            'addTeamMember:success'
          );
        } catch (error: unknown) {
          const projectError = error as ProjectServiceError;
          const errorMessage = projectError instanceof ProjectApiError 
            ? projectError.message 
            : projectError.message || 'Failed to add team member';

          set(
            (state) => ({
              loading: { ...state.loading, teamManagement: false },
              error: errorMessage,
            }),
            false,
            'addTeamMember:error'
          );

          throw error;
        }
      },

      removeTeamMember: async (projectId: string, memberId: string): Promise<void> => {
        set(
          (state) => ({
            loading: { ...state.loading, teamManagement: true },
            error: null,
          }),
          false,
          'removeTeamMember:start'
        );

        try {
          await projectService.removeTeamMember(projectId, memberId);

          // Reload the current project to get updated team data
          if (get().currentProject?.id === projectId) {
            await get().loadProject(projectId);
          }

          set(
            (state) => ({
              loading: { ...state.loading, teamManagement: false },
            }),
            false,
            'removeTeamMember:success'
          );
        } catch (error: unknown) {
          const projectError = error as ProjectServiceError;
          const errorMessage = projectError instanceof ProjectApiError 
            ? projectError.message 
            : projectError.message || 'Failed to remove team member';

          set(
            (state) => ({
              loading: { ...state.loading, teamManagement: false },
              error: errorMessage,
            }),
            false,
            'removeTeamMember:error'
          );

          throw error;
        }
      },

      clearError: (): void => {
        set({ error: null }, false, 'clearError');
      },

      clearCurrentProject: (): void => {
        set({ currentProject: null }, false, 'clearCurrentProject');
      },
    }),
    {
      name: 'project-store',
    }
  )
);

// Convenience hooks
export const useProjects = () => {
  const store = useProjectStore();
  return {
    projects: store.projects,
    pagination: store.pagination,
    filters: store.filters,
    loading: store.loading.projects,
    error: store.error,
  };
};

export const useCurrentProject = () => {
  const store = useProjectStore();
  return {
    project: store.currentProject,
    loading: store.loading.currentProject,
    error: store.error,
  };
};

export const useProjectActions = () => {
  const store = useProjectStore();
  return {
    setFilters: store.setFilters,
    loadProjects: store.loadProjects,
    loadProject: store.loadProject,
    createProject: store.createProject,
    updateProject: store.updateProject,
    deleteProject: store.deleteProject,
    addTeamMember: store.addTeamMember,
    removeTeamMember: store.removeTeamMember,
    clearError: store.clearError,
    clearCurrentProject: store.clearCurrentProject,
  };
};

// Additional convenience hooks for specific loading states
export const useProjectLoadingStates = () => {
  const store = useProjectStore();
  return store.loading;
};

// Export types for external use
export type { 
  ProjectStore, 
  ProjectState, 
  ProjectActions, 
  ProjectServiceError, 
  LoadingState 
};