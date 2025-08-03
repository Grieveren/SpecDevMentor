# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Commands

### Development
```bash
# Start development servers (client + server)
pnpm dev

# Start individual services
pnpm --filter client dev    # React frontend on :5173
pnpm --filter server dev    # Express backend on :3001

# Start databases
pnpm docker:up              # PostgreSQL + Redis containers
```

### Building & Testing
```bash
# Build everything with type checking
pnpm build

# Type checking across all workspaces
pnpm type-check

# Run all tests
pnpm test                   # Unit tests (Vitest)
pnpm test:e2e              # End-to-end tests (Playwright)
pnpm test:e2e:ui           # E2E tests with UI

# Code quality
pnpm lint                  # ESLint across workspaces
pnpm lint:fix              # Auto-fix linting issues
pnpm format                # Format with Prettier
```

### Database Operations
```bash
pnpm db:migrate            # Run Prisma migrations
pnpm db:seed               # Seed with sample data
pnpm db:reset              # Reset and reseed database
pnpm db:studio             # Open Prisma Studio GUI
```

### Specialized Test Suites
```bash
# Run specific E2E test categories
pnpm test:smoke:run        # Core functionality tests
pnpm test:security:run     # Security-focused tests
pnpm test:accessibility:run # Accessibility compliance tests
pnpm test:performance:run  # Performance benchmarks
pnpm test:compliance:run   # Compliance validation tests
```

## Architecture Overview

### Monorepo Structure
- **pnpm workspaces** with TypeScript throughout
- **client/**: React 18 + Vite + TailwindCSS frontend
- **server/**: Express + TypeScript backend with Socket.IO
- **shared/**: Common TypeScript types and utilities

### Core Technology Stack
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for sessions and real-time state
- **Authentication**: JWT with refresh token rotation
- **Real-time**: Socket.IO for collaborative editing
- **AI Integration**: OpenAI API for specification review
- **Testing**: Vitest (unit) + Playwright (E2E) + Testing Library

### Backend Architecture
The server follows a **service-oriented architecture** with domain-specific services:

- **SpecificationWorkflowService**: Manages 4-phase development workflow (Requirements → Design → Tasks → Implementation)
- **AIReviewService**: AI-powered code and specification analysis
- **CollaborationService**: Real-time collaborative editing with Socket.IO
- **ProjectService**: Project lifecycle and team management
- **AuthService**: JWT authentication with role-based access control

Each service has corresponding routes in `/server/src/routes/` and comprehensive test coverage.

### Frontend Architecture
React components organized by feature domains:

- `/components/specification/`: Core specification editing and workflow
- `/components/collaboration/`: Real-time collaborative features
- `/components/ai-review/`: AI feedback and suggestions interface
- `/components/analytics/`: Performance and progress tracking

State management uses **Zustand** for global state and **TanStack Query** for server state.

### Database Schema
Prisma schema centers around:
- **SpecificationProject**: Four-phase workflow projects
- **User**: Role-based access (STUDENT, DEVELOPER, TEAM_LEAD, ADMIN)
- **SpecificationDocument**: Phase-specific content with versioning
- **CommentThread**: Collaborative feedback system
- **AIReview**: AI-generated suggestions and metrics

### Key Development Patterns

1. **Specification-Driven Development**: Structured 4-phase workflow with AI guidance
2. **Real-time Collaboration**: Socket.IO integration for live editing and comments
3. **Type Safety**: Strict TypeScript with shared types between client/server
4. **Comprehensive Testing**: Unit, integration, E2E, and specialized test suites
5. **Security-First**: RBAC, input validation, audit logging

### Environment Setup
- Docker Compose provides PostgreSQL + Redis for local development
- Environment variables required: `DATABASE_URL`, `REDIS_URL`, `OPENAI_API_KEY`, `JWT_SECRET`
- Health checks available at `/health` endpoint

### Performance Considerations
- Real-time collaboration optimized for 50+ concurrent users
- AI response times < 3 seconds for specification reviews
- Comprehensive caching strategy with Redis
- Bundle analysis tools available via `pnpm build:analyze`

## Development Workflow
1. Ensure Docker services are running (`pnpm docker:up`)
2. Run database migrations (`pnpm db:migrate`)
3. Start development servers (`pnpm dev`)
4. Run tests before committing (`pnpm test && pnpm test:e2e`)
5. Type check and lint (`pnpm type-check && pnpm lint`)