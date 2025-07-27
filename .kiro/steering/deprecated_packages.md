---
inclusion: always
---

# Package Management Standards

## Critical Package Requirements

### Core Dependencies
- **TypeScript**: 5.x+ for latest language features and strict type checking
- **Node.js**: Use LTS version with proper version constraints in `.nvmrc`
- **pnpm**: Preferred package manager for monorepo workspace management
- **React**: 18+ with concurrent features and strict mode enabled

### Development Tools
- **Vite**: 5+ for fast development server and HMR (avoid deprecated Webpack configs)
- **Jest**: 29+ with proper ESM support and React Testing Library integration
- **ESLint**: 9+ with flat config format (avoid deprecated `.eslintrc` formats)
- **Prettier**: Latest stable for consistent code formatting

## Deprecated Package Avoidance

### Known Problematic Packages
- **Supertest v6.x**: Memory leaks and deprecated APIs - use v7+
- **rimraf**: Use Node.js built-in `fs.rm` with `recursive: true`
- **inflight**: Causes memory leaks - avoid or replace with modern alternatives
- **request**: Deprecated HTTP client - use axios or fetch

### Security-Critical Updates
- Address `npm audit` vulnerabilities immediately
- Monitor GitHub security advisories for dependencies
- Use `npm ci` in production for reproducible, secure builds
- Pin exact versions for security-sensitive packages

## Monorepo Workspace Standards

### Package.json Configuration
```json
{
  "engines": {
    "node": ">=18.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.x"
}
```

### Workspace Dependencies
- Use workspace protocol (`workspace:*`) for internal packages
- Hoist common dependencies to root when possible
- Avoid duplicate versions of React, TypeScript, and testing libraries

## Database and Backend Standards

### Required Packages
- **Prisma**: Latest stable for type-safe database access
- **PostgreSQL (pg)**: Latest with proper connection pooling
- **Redis**: Use `ioredis` for better TypeScript support
- **Express**: Latest with proper middleware stack

### Environment and Configuration
- **Joi**: For environment variable validation and schema enforcement
- **Winston**: Structured logging with appropriate log levels
- **Helmet**: Security headers for Express applications
- **express-rate-limit**: Rate limiting middleware

## Quality Assurance Tools

### Testing Stack
- Jest 29+ with proper ESM and TypeScript configuration
- React Testing Library for component testing
- MSW (Mock Service Worker) for API mocking
- Supertest v7+ for API endpoint testing

### Code Quality
- TypeScript strict mode enabled in all projects
- ESLint with TypeScript parser and React hooks rules
- Prettier integration with consistent formatting
- Husky pre-commit hooks for quality gates

## Maintenance Workflow

### Regular Maintenance Tasks
1. Run `pnpm outdated` weekly to check for updates
2. Test dependency updates in isolated branches
3. Monitor deprecation warnings during builds
4. Update `@types/*` packages alongside runtime dependencies

### Version Management
- Use exact versions for critical security dependencies
- Use semver ranges for development tools and non-critical packages
- Document version constraints and reasoning in package.json comments
- Maintain compatibility matrices for major version updates