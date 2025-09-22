import express from 'express';
import type { Express } from 'express';
import helmet from 'helmet';
import { registerRoutes } from './routes/register.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';

const createApp = (): Express => {
  const app = express();

  app.use(helmet());
  app.use(express.json());

  registerRoutes(app);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use(errorHandler);

  return app;
};

if (env.NODE_ENV !== 'test') {
  const port = env.PORT;
  const app = createApp();
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${port}`);
  });
}

export { createApp };
