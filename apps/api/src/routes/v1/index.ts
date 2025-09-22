import { Router } from 'express';
import { router as projectRouter } from './projects.js';

const router: Router = Router();

router.use('/projects', projectRouter);

export { router };
