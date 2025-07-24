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
  loading: boolean;
  error: string | null;

  // Actions
  setFilters: (filters: ProjectFilters) => void;
  loadProjects: (pagination?: PaginationOptions) => Promise<void>;
  loadProject: (id: string) => Promise<void>;
  createProject: (data: CreateProjectRequest) => Promise<Project>;
  updateProject: (id: string, data: UpdateProjectRequest) => Promise<Project>;
  deleteProject: (id: string) => Promise<void>;
  addTeamMember: (projectId: string, data: AddTeamMemberRequest) => Promise<void>;
  removeTeamMember: (projectId: string, memberId: string) => Promise<void>;
  clearError: () => void;
  clearCurrentProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
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
      loading: false,
      error: null,

      // Actions
      setFilters: (filters: ProjectFilters) => {
        set({ filters }, false, 'setFilters');
      },

      loadProjects: async (pagination?: PaginationOptions) => {
        set({ loading: true, error: null }, false, 'loadProjects:start');

        try {
          const { filters } = get();
          const paginationOptions = pagination || {
            page: get().pagination.page,
            limit: get().pagination.limit,
          };

          const result = await projectService.getProjects(filters, paginationOptions);

          set(
            {
              projects: result.projects,
              pagination: result.pagination,
              loading: false,
            },
            false,
            'loadProjects:success'
          );
        } catch (error) {
          const errorMessage = error instanceof ProjectApiError 
            ? error.message 
            : 'Failed to load projects';

          set(
            {
              loading: false,
              error: errorMessage,
            },
            false,
            'loadProjects:error'
          );
        }
      },

      loadProject: async (id: string) => {
        set({ loading: true, error: null }, false, 'loadProject:start');

        try {
          const project = await projectService.getProject(id);

          set(
            {
              currentProject: project,
              loading: false,
            },
            false,
            'loadProject:success'
          );
        } catch (error) {
          const errorMessage = error instanceof ProjectApiError 
            ? error.message 
            : 'Failed to load project';

          set(
            {
              loading: false,
              error: errorMessage,
            },
            false,
            'loadProject:error'
          );
        }
      },

      createProject: async (data: CreateProjectRequest) => {
        set({ loading: true, error: null }, false, 'createProject:start');

        try {
          const project = await projectService.createProject(data);

          set(
            (state) => ({
              projects: [project, ...state.projects],
              loading: false,
            }),
            false,
            'createProject:success'
          );

          return project;
        } catch (error) {
          const errorMessage = error instanceof ProjectApiError 
            ? error.message 
            : 'Failed to create project';

          set(
            {
              loading: false,
              error: errorMessage,
            },
            false,
            'createProject:error'
          );

          throw error;
        }
      },

      updateProject: async (id: string, data: UpdateProjectRequest) => {
        set({ loading: true, error: null }, false, 'updateProject:start');

        try {
          const updatedProject = await projectService.updateProject(id, data);

          set(
            (state) => ({
              projects: state.projects.map((p) => (p.id === id ? updatedProject : p)),
              currentProject: state.currentProject?.id === id ? updatedProject : state.currentProject,
              loading: false,
            }),
            false,
            'updateProject:success'
          );

          return updatedProject;
        } catch (error) {
          const errorMessage = error instanceof ProjectApiError 
            ? error.message 
            : 'Failed to update project';

          set(
            {
              loading: false,
              error: errorMessage,
            },
            false,
            'updateProject:error'
          );

          throw error;
        }
      },

      deleteProject: async (id: string) => {
        set({ loading: true, error: null }, false, 'deleteProject:start');

        try {
          await projectService.deleteProject(id);

          set(
            (state) => ({
              projects: state.projects.filter((p) => p.id !== id),
              currentProject: state.currentProject?.id === id ? null : state.currentProject,
              loading: false,
            }),
            false,
            'deleteProject:success'
          );
        } catch (error) {
          const errorMessage = error instanceof ProjectApiError 
            ? error.message 
            : 'Failed to delete project';

          set(
            {
              loading: false,
              error: errorMessage,
            },
            false,
            'deleteProject:error'
          );

          throw error;
        }
      },

      addTeamMember: async (projectId: string, data: AddTeamMemberRequest) => {
        set({ loading: true, error: null }, false, 'addTeamMember:start');

        try {
          await projectService.addTeamMember(projectId, data);

          // Reload the current project to get updated team data
          if (get().currentProject?.id === projectId) {
            await get().loadProject(projectId);
          }

          set({ loading: false }, false, 'addTeamMember:success');
        } catch (error) {
          const errorMessage = error instanceof ProjectApiError 
            ? error.message 
            : 'Failed to add team member';

          set(
            {
              loading: false,
              error: errorMessage,
            },
            false,
            'addTeamMember:error'
          );

          throw error;
        }
      },

      removeTeamMember: async (projectId: string, memberId: string) => {
        set({ loading: true, error: null }, false, 'removeTeamMember:start');

        try {
          await projectService.removeTeamMember(projectId, memberId);

          // Reload the current project to get updated team data
          if (get().currentProject?.id === projectId) {
            await get().loadProject(projectId);
          }

          set({ loading: false }, false, 'removeTeamMember:success');
        } catch (error) {
          const errorMessage = error instanceof ProjectApiError 
            ? error.message 
            : 'Failed to remove team member';

          set(
            {
              loading: false,
              error: errorMessage,
            },
            false,
            'removeTeamMember:error'
          );

          throw error;
        }
      },

      clearError: () => {
        set({ error: null }, false, 'clearError');
      },

      clearCurrentProject: () => {
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
    loading: store.loading,
    error: store.error,
  };
};

export const useCurrentProject = () => {
  const store = useProjectStore();
  return {
    project: store.currentProject,
    loading: store.loading,
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