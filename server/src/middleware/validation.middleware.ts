import { NextFunction, Request, Response } from 'express';
import { ValidationError as ExpressValidationError, validationResult } from 'express-validator';
import { Middleware, ValidationError, ValidationErrorDetail } from '../types/express.js';

/**
 * Middleware to validate request data using express-validator
 */
export const validateRequest: Middleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const details: ValidationErrorDetail[] = errors
      .array()
      .map((error: ExpressValidationError) => ({
        field: error.type === 'field' ? error.path : 'unknown',
        message: error.msg,
        value: error.type === 'field' ? error.value : undefined,
      }));

    const validationError: ValidationError = {
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details,
    };

    res.status(400).json(validationError);
    return;
  }

  next();
};
