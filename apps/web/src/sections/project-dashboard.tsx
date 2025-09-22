import { useEffect, useState } from 'react';
import type { ProjectOverview, ProjectSummary } from '@shared/project';

const fetchProjects = async (): Promise<ProjectSummary[]> => {
  const response = await fetch('/api/v1/projects');
  if (!response.ok) {
    throw new Error('Failed to load projects');
  }
  const payload = (await response.json()) as { data: ProjectSummary[] };
  return payload.data;
};

const fetchProject = async (projectId: string): Promise<ProjectOverview> => {
  const response = await fetch(`/api/v1/projects/${projectId}`);
  if (!response.ok) {
    throw new Error('Failed to load project');
  }
  const payload = (await response.json()) as { data: ProjectOverview };
  return payload.data;
};

export const ProjectDashboard = () => {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProjects()
      .then((items) => {
        setProjects(items);
        if (items.length > 0) {
          void fetchProject(items[0].id).then(setSelectedProject).catch((err) => {
            console.error(err);
            setSelectedProject(null);
          });
        }
      })
      .catch((err) => {
        console.error(err);
        setError('Unable to load projects');
      });
  }, []);

  const handleSelectProject = (projectId: string) => {
    void fetchProject(projectId)
      .then(setSelectedProject)
      .catch((err) => {
        console.error(err);
        setError('Unable to load project details');
      });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-base font-medium text-slate-900">Projects</h2>
        <p className="mt-1 text-sm text-slate-500">Select a project to view its workflow.</p>
        <div className="mt-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {projects.length === 0 && !error ? (
            <p className="text-sm text-slate-500">No projects yet. Create one via the API.</p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => handleSelectProject(project.id)}
                className="w-full rounded border border-slate-200 p-3 text-left hover:border-slate-300"
              >
                <h3 className="text-sm font-semibold text-slate-800">{project.name}</h3>
                <p className="mt-1 text-xs text-slate-500">{project.description || 'No description'}</p>
                <p className="mt-2 text-[11px] uppercase tracking-wide text-slate-400">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      {selectedProject && (
        <div className="rounded-lg border bg-white p-4 shadow-sm">
          <h2 className="text-base font-medium text-slate-900">Workflow overview</h2>
          <dl className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <dt>Current phase</dt>
              <dd className="font-medium capitalize">{selectedProject.workflow.currentPhase}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Completed phases</dt>
              <dd>{selectedProject.workflow.completedPhases.length}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Pending approval</dt>
              <dd>{selectedProject.workflow.pendingApproval ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt>Progress</dt>
              <dd>{selectedProject.workflow.progressPercentage}%</dd>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
};
