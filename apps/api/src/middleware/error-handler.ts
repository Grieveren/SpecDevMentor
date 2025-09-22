import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'ValidationError',
      issues: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message
      }))
    });
    return;
  }

  if (err instanceof Error) {
    res.status(500).json({ error: err.name, message: err.message });
    return;
  }

  res.status(500).json({ error: 'UnknownError' });
};
