import { Router } from 'express';
import { z } from 'zod';
import type {
  CreateProjectRequest,
  ProjectOverview,
  ProjectSummary
} from '@codementor-ai/shared/project';
import { ProjectService } from '../../services/project-service.js';

const projectService = new ProjectService();

const createProjectSchema = z.object({
  name: z.string().min(3),
  description: z.string().max(500).optional()
});

const router: Router = Router();

type ProjectListResponse = { data: ProjectSummary[] };
type ProjectOverviewResponse = { data: ProjectOverview };

router.get('/', async (_req, res) => {
  const projects = await projectService.listProjects();
  res.json({ data: projects } satisfies ProjectListResponse);
});

router.get('/:projectId', async (req, res) => {
  const project = await projectService.getProject(req.params.projectId);
  if (!project) {
    res.status(404).json({ error: 'ProjectNotFound' });
    return;
  }
  res.json({ data: project } satisfies ProjectOverviewResponse);
});

router.post('/', async (req, res, next) => {
  try {
    const payload: CreateProjectRequest = createProjectSchema.parse(req.body);
    const project = await projectService.createProject(payload);
    res.status(201).json({ data: project } satisfies ProjectOverviewResponse);
  } catch (error) {
    next(error);
  }
});

export { router };
