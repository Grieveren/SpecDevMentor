# Authentication Fix Design

## Overview

The authentication system is failing because the development server is running a simplified version (`index-simple.ts`) instead of the full server (`index.ts`) that includes complete authentication routes. This design outlines the solution to fix the server configuration and ensure proper authentication functionality.

## Architecture

### Current Problem

- Development server runs `index-simple.ts` with minimal endpoints
- Missing complete authentication routes (`/api/auth/register`, `/api/auth/logout`, etc.)
- No Redis integration for session management
- No proper password hashing or token management

### Solution Architecture

- Switch development server to use full `index.ts`
- Ensure Redis connection is established
- Verify all authentication routes are properly registered
- Add missing error handler utility for auth service

## Components and Interfaces

### 1. Server Configuration Fix

**File:** `server/package.json`

- Update dev script to use `index.ts` instead of `index-simple.ts`
- Ensure proper TypeScript compilation

**File:** `server/src/utils/error-handler.ts` (Missing)

- Create error handler decorator used by auth service
- Provide consistent error handling across services

### 2. Authentication Route Registration

**File:** `server/src/index.ts`

- Verify Redis initialization before route registration
- Ensure auth routes are properly mounted at `/api/auth`
- Add proper error handling for service initialization

### 3. Redis Connection Management

**File:** `server/src/utils/redis.ts`

- Ensure Redis client is properly initialized
- Handle connection failures gracefully
- Provide connection status checking

### 4. Environment Configuration

**Files:** `server/.env`, `server/.env.example`

- Verify all required environment variables are set
- Add missing JWT secrets if needed
- Ensure database connection string is correct

## Data Models

### User Registration Flow

```typescript
interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

interface RegisterResponse {
  success: boolean;
  message: string;
  data: {
    user: User;
    tokens: TokenPair;
  };
}
```

### Authentication Service Dependencies

```typescript
interface AuthServiceDependencies {
  redis: Redis;
  prisma: PrismaClient;
  jwtSecret: string;
  refreshSecret: string;
}
```

## Error Handling

### Missing Error Handler Utility

Create `server/src/utils/error-handler.ts` with:

- `handleServiceError` decorator for consistent error handling
- Proper error logging and transformation
- Integration with shared error types

### Service Error Handling

- Database connection errors
- Redis connection errors
- JWT secret configuration errors
- Validation errors from request body

## Testing Strategy

### Manual Testing

1. Start development server with corrected configuration
2. Test registration endpoint with curl/Postman
3. Verify user creation in database
4. Test login with created user
5. Verify token generation and storage

### Integration Testing

1. Test complete authentication flow
2. Verify Redis session management
3. Test error scenarios (invalid data, duplicate email)
4. Verify proper error responses

### Environment Testing

1. Test with missing environment variables
2. Test with Redis unavailable
3. Test with database unavailable
4. Verify graceful degradation

## Implementation Notes

### Server Startup Sequence

1. Load environment variables
2. Initialize Prisma client
3. Connect to Redis
4. Register middleware
5. Register authentication routes
6. Register other API routes
7. Start HTTP server

### Development vs Production

- Development: Use local Redis and PostgreSQL
- Production: Use managed Redis and PostgreSQL
- Environment-specific error handling and logging

### Security Considerations

- Ensure JWT secrets are properly configured
- Verify password hashing is working
- Check CORS configuration for client URL
- Validate rate limiting is applied to auth endpoints
