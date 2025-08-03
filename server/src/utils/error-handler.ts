import { AppError, ErrorCode } from '../../../shared/types';

/**
 * Decorator for handling service errors consistently
 * Catches errors and transforms them into appropriate AppError instances
 */
export function handleServiceError(
  _target: unknown,
  _propertyName: string,
  descriptor: PropertyDescriptor
) {
  const method = descriptor.value;

  descriptor.value = async function (...args: unknown[]) {
    try {
      return await method.apply(this, args);
    } catch (error) {
      // If it's already an AppError, just re-throw it
      if (error instanceof AppError) {
        throw error;
      }

      // Handle Prisma errors
      if (error && typeof error === 'object' && 'code' in error) {
        const prismaError = error as {
          code: string;
          meta?: { target?: string[] };
          message: string;
        };

        switch (prismaError.code) {
          case 'P2002': {
            // Unique constraint violation
            const field = prismaError.meta?.target?.[0] || 'field';
            throw new AppError(`${field} already exists`, ErrorCode.CONFLICT, 409, true, {
              field,
              originalError: prismaError.message,
            });
          }

          case 'P2025':
            // Record not found
            throw new AppError('Record not found', ErrorCode.NOT_FOUND, 404, true, {
              originalError: prismaError.message,
            });

          case 'P2003':
            // Foreign key constraint violation
            throw new AppError(
              'Invalid reference to related record',
              ErrorCode.VALIDATION_ERROR,
              400,
              true,
              { originalError: prismaError.message }
            );

          default:
            // Other Prisma errors
            throw new AppError('Database operation failed', ErrorCode.DATABASE_ERROR, 500, true, {
              prismaCode: prismaError.code,
              originalError: prismaError.message,
            });
        }
      }

      // Handle Redis errors
      if (error && typeof error === 'object' && 'command' in error) {
        const redisError = error as { command: string; message?: string };
        throw new AppError('Cache operation failed', ErrorCode.EXTERNAL_SERVICE_ERROR, 500, true, {
          service: 'redis',
          originalError: redisError.message || 'Redis operation failed',
        });
      }

      // Handle JWT errors
      if (error && typeof error === 'object' && 'name' in error) {
        const jwtError = error as { name: string; message: string };
        if (jwtError.name === 'JsonWebTokenError') {
          throw new AppError('Invalid token', ErrorCode.TOKEN_INVALID, 401, true, {
            originalError: jwtError.message,
          });
        }
        if (jwtError.name === 'TokenExpiredError') {
          throw new AppError('Token expired', ErrorCode.TOKEN_EXPIRED, 401, true, {
            originalError: jwtError.message,
          });
        }
      }

      // Handle bcrypt errors
      if (error instanceof Error && error.message.includes('bcrypt')) {
        throw new AppError('Password processing failed', ErrorCode.UNKNOWN_ERROR, 500, true, {
          originalError: error.message,
        });
      }

      // Handle generic errors
      if (error instanceof Error) {
        throw new AppError(
          error.message || 'Service operation failed',
          ErrorCode.UNKNOWN_ERROR,
          500,
          true,
          { originalError: error.message, stack: error.stack }
        );
      }

      // Handle unknown error types
      throw new AppError('Unknown error occurred', ErrorCode.UNKNOWN_ERROR, 500, false, {
        originalError: String(error),
      });
    }
  };

  return descriptor;
}

/**
 * Utility function to handle service errors without decorator
 * Useful for cases where decorators can't be used
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  _context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    // Apply the same error handling logic as the decorator
    const descriptor = { value: operation };
    handleServiceError({}, 'operation', descriptor);

    // This should never be reached due to the error handling above
    throw error;
  }
}

/**
 * Log service errors for monitoring and debugging
 */
export function logServiceError(error: AppError, context?: string) {
  const logData = {
    timestamp: new Date().toISOString(),
    context: context || 'unknown',
    error: {
      name: error.name,
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      isOperational: error.isOperational,
      context: error.context,
    },
  };

  if (error.statusCode >= 500) {
    console.error('Service Error:', JSON.stringify(logData, null, 2));
  } else {
    console.warn('Service Warning:', JSON.stringify(logData, null, 2));
  }
}
