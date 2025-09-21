import { NextFunction, Request, Response } from 'express';
import { ValidationError as ExpressValidationError, validationResult } from 'express-validator';
import { Middleware, ValidationError, ValidationErrorDetail } from '../types/express.js';
import Joi from 'joi';

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
      error: 'Validation failed',
      details,
    };

    res.status(400).json(validationError);
    return;
  }

  next();
};

/**
 * Middleware to validate request data using Joi schemas
 */
export const validationMiddleware = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const details: ValidationErrorDetail[] = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
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
};
