import type { Express } from 'express';
import { router as v1Router } from './v1/index.js';

export const registerRoutes = (app: Express) => {
  app.use('/api/v1', v1Router);
};
