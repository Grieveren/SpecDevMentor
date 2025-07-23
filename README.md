# CodeMentor AI Platform

A comprehensive AI-powered specification-based development learning platform that teaches developers the complete workflow of spec-driven development methodology through interactive lessons, collaborative tools, and hands-on exercises.

## Features

- **Specification Workflow Management**: Structured workflow (Requirements → Design → Tasks → Implementation)
- **AI-Powered Review**: Intelligent analysis and feedback on specification documents
- **Real-time Collaboration**: Multi-user editing with conflict resolution
- **Interactive Learning**: Structured curriculum with hands-on exercises
- **Code Execution & Validation**: Secure sandbox for testing implementations
- **Template Library**: Best practice templates and examples
- **Progress Tracking**: Analytics and skill development monitoring

## Workspace Structure

This project uses pnpm workspaces for monorepo management:

- **client/**: React frontend application with TypeScript
- **server/**: Node.js backend API with TypeScript  
- **packages/**: Shared utilities and components (future expansion)

The root package.json defines workspace scripts that operate across all packages, enabling efficient development and build processes.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + Prisma ORM
- **Cache**: Redis
- **Real-time**: Socket.IO
- **AI**: OpenAI API integration
- **Testing**: Vitest + React Testing Library
- **Monorepo**: pnpm workspaces
- **Code Quality**: ESLint + Prettier + Husky pre-commit hooks

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+ (required for workspace management)
- Docker & Docker Compose

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd codementor-ai-platform
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

   This will install dependencies for all workspaces (client, server, and shared packages) using pnpm's workspace feature.

3. **Set up environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development services**

   ```bash
   # Start PostgreSQL and Redis
   pnpm docker:up

   # Run database migrations (after setting up Prisma)
   pnpm db:migrate

   # Start development servers
   pnpm dev
   ```

5. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001
   - Health Check: http://localhost:3001/health

## Development Scripts

### Root Level Commands

```bash
# Development
pnpm dev              # Start both client and server in development mode
pnpm build            # Build both client and server for production
pnpm test             # Run tests in all workspaces
pnpm test:watch       # Run tests in watch mode across workspaces
pnpm lint             # Lint all workspaces
pnpm lint:fix         # Auto-fix linting issues across workspaces
pnpm format           # Format code with Prettier
pnpm format:check     # Check code formatting without changes
pnpm type-check       # Run TypeScript type checking across workspaces
pnpm clean            # Clean build artifacts in all workspaces

# Docker
pnpm docker:up        # Start PostgreSQL and Redis containers
pnpm docker:down      # Stop containers
pnpm docker:logs      # View container logs

# Database
pnpm db:migrate       # Run database migrations
pnpm db:seed          # Seed database with sample data
pnpm db:reset         # Reset database

# Setup
pnpm prepare          # Install Husky git hooks
```

### Client Commands

```bash
cd client
pnpm dev              # Start Vite development server
pnpm build            # Build for production
pnpm test             # Run Vitest tests
pnpm test:ui          # Run tests with UI
pnpm lint             # ESLint check
```

### Server Commands

```bash
cd server
pnpm dev              # Start development server with tsx watch
pnpm build            # Build TypeScript to JavaScript
pnpm start            # Start production server
pnpm test             # Run Vitest tests
pnpm db:studio        # Open Prisma Studio
```

## Project Structure

```
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── services/       # API clients
│   │   ├── stores/         # Zustand state management
│   │   ├── types/          # TypeScript definitions
│   │   └── utils/          # Utility functions
│   ├── public/             # Static assets
│   └── package.json
├── server/                 # Node.js backend application
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── middleware/     # Express middleware
│   │   ├── models/         # Database models
│   │   ├── services/       # Business logic
│   │   ├── routes/         # API routes
│   │   └── utils/          # Utility functions
│   ├── prisma/             # Database schema and migrations
│   └── package.json
├── packages/               # Shared packages and utilities
├── docker/                 # Docker configuration
├── .kiro/                  # Kiro IDE configuration
└── package.json            # Root package.json with workspace configuration
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

- **Database**: PostgreSQL connection string
- **Redis**: Redis connection string
- **JWT**: Secret keys for authentication
- **OpenAI**: API key for AI features
- **SMTP**: Email configuration for notifications

## Docker Services

The development environment includes:

- **PostgreSQL**: Main database (port 5432)
- **Redis**: Caching and sessions (port 6379)
- **PostgreSQL Test**: Test database (port 5433)
- **Redis Test**: Test cache (port 6380)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Architecture

CodeMentor-AI follows a modern microservices architecture designed for scalability and real-time collaboration:

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Headless UI
- **Backend**: Node.js + Express + TypeScript with microservices pattern
- **Database**: PostgreSQL with Prisma ORM for type-safe database access
- **Cache & Sessions**: Redis for caching, sessions, and real-time collaboration state
- **Real-time**: Socket.IO for collaborative editing and live updates
- **AI Integration**: OpenAI API with intelligent caching and rate limiting
- **Code Execution**: Secure Docker-based sandboxing with resource limits
- **Authentication**: JWT-based auth with refresh tokens and RBAC
- **Infrastructure**: Docker Compose for development, Kubernetes for production

## Project Structure

```
CodeMentor-AI/
├── client/          # Frontend React application with TypeScript
├── server/          # Backend API server with specification services
├── code-runner/     # Secure Docker-based code execution service
├── database/        # Database schemas, migrations, and seed data
├── docker/          # Docker configurations and compose files
├── docs/            # Project documentation and API specs
├── packages/        # Shared packages and utilities
├── .kiro/           # Kiro specifications and project configuration
├── README.md        # This file
└── LICENSE          # MIT License
```

## Features

### Specification-Based Development Learning

- **Requirements Engineering**: Interactive lessons on creating EARS-format requirements and user stories
- **Design Documentation**: Guided creation of architecture documents, component specifications, and data models
- **Task Breakdown**: Structured approach to breaking down designs into implementable tasks
- **Implementation Tracking**: Code-to-specification traceability and validation

### AI-Powered Assistance

- **Specification Review**: AI analysis of requirements, design, and task documents for quality and completeness
- **Methodology Coaching**: Interactive AI tutor specialized in specification-based development practices
- **Code Validation**: Automated checking of implementation against original specifications
- **Best Practice Guidance**: Real-time suggestions for improving specification quality

### Collaborative Development

- **Real-time Collaboration**: Multi-user editing of specification documents with conflict resolution
- **Review Workflows**: Structured approval processes for specification documents
- **Team Progress Tracking**: Analytics on specification methodology adoption and team effectiveness
- **Template Library**: Comprehensive collection of specification templates and examples

### Learning and Progress

- **Methodology Curriculum**: Step-by-step lessons on specification-based development principles
- **Hands-on Workshops**: Practical exercises simulating real-world specification scenarios
- **Skill Assessment**: Progress tracking for specification creation and methodology mastery
- **Business Impact Education**: Understanding ROI and organizational benefits of spec-driven development

## Security

CodeMentor-AI implements enterprise-grade security features:

- **Authentication**: JWT-based authentication with secure refresh token rotation
- **Authorization**: Role-based access control (RBAC) with granular permissions
- **Code Execution**: Secure Docker sandboxing with resource limits and network isolation
- **Input Validation**: Comprehensive sanitization and validation of all user inputs
- **Audit Logging**: Complete audit trail of all user actions and system events
- **Rate Limiting**: Advanced rate limiting to prevent abuse and ensure fair usage
- **Data Encryption**: Encryption at rest and in transit for sensitive data

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- PostgreSQL (v14 or higher)
- Redis (v6 or higher)
- Git
- pnpm (recommended) or npm

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/your-username/CodeMentor-AI.git
   cd CodeMentor-AI
   ```

2. Install dependencies:

   ```bash
   pnpm install
   # or
   npm install
   ```

3. Set up environment variables:

   ```bash
   # Client environment
   cp client/.env.example client/.env.local

   # Server environment
   cp server/.env.example server/.env

   # Code runner environment
   cp code-runner/.env.example code-runner/.env
   ```

4. Configure your environment variables:

   ```bash
   # Essential environment variables
   DATABASE_URL="postgresql://username:password@localhost:5432/codementor_ai"
   REDIS_URL="redis://localhost:6379"
   OPENAI_API_KEY="your-openai-api-key"
   JWT_SECRET="your-secure-jwt-secret"
   REFRESH_SECRET="your-secure-refresh-secret"
   ENCRYPTION_SALT="your-encryption-salt"
   ```

5. Start the development environment:

   ```bash
   # Start all services with Docker
   docker-compose up -d

   # Run database migrations
   pnpm run db:migrate

   # Seed the database with sample data
   pnpm run db:seed

   # Start development servers
   pnpm run dev
   ```

### Quick Start Guide

1. **Access the Application**: Navigate to `http://localhost:5173` for the client application
2. **Create Your First Specification Project**: Use the guided project creation wizard
3. **Follow the Methodology**: Progress through Requirements → Design → Tasks → Implementation phases
4. **Get AI Feedback**: Request AI review at each phase for quality improvement
5. **Collaborate**: Invite team members for real-time collaborative specification development

## Development

### Code Quality

This project uses comprehensive code quality tools:

- **ESLint** for JavaScript/TypeScript linting with strict rules
- **Prettier** for consistent code formatting
- **Jest** with React Testing Library for comprehensive testing
- **Husky** for git hooks and pre-commit validation
- **TypeScript** in strict mode for type safety
- **Prisma** for type-safe database operations

### Testing Strategy

- **Unit Tests**: Jest with React Testing Library (80%+ coverage target)
- **Integration Tests**: API testing with MSW for mocking
- **End-to-End Tests**: Playwright for complete user workflows
- **Security Tests**: Automated security scanning and penetration testing
- **Performance Tests**: Load testing for concurrent collaboration scenarios

### Code Quality

This project uses comprehensive code quality tools:

- **ESLint** for JavaScript/TypeScript linting with strict rules
- **Prettier** for consistent code formatting
- **Jest** with React Testing Library for comprehensive testing
- **Husky** for git hooks and pre-commit validation
- **TypeScript** in strict mode for type safety
- **Prisma** for type-safe database operations

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes following the coding standards
4. Write tests for new functionality
5. Ensure all tests pass: `pnpm run test`
6. Run linting and formatting: `pnpm run lint && pnpm run format`
7. Commit your changes: `git commit -m 'feat: add your feature'`
8. Push to the branch: `git push origin feature/your-feature`
9. Submit a pull request

## Scripts

### Development

- `pnpm run dev` - Start all development servers (client, server, code-runner)
- `pnpm run dev:client` - Start client development server only
- `pnpm run dev:server` - Start server development server only
- `pnpm run dev:code-runner` - Start code execution service only

### Building

- `pnpm run build` - Build all applications for production
- `pnpm run build:client` - Build client application
- `pnpm run build:server` - Build server application
- `pnpm run build:code-runner` - Build code execution service

### Testing

- `pnpm run test` - Run all tests
- `pnpm run test:client` - Run client tests
- `pnpm run test:server` - Run server tests
- `pnpm run test:e2e` - Run end-to-end tests
- `pnpm run test:coverage` - Run tests with coverage report

### Code Quality

- `pnpm run lint` - Run linter across all packages
- `pnpm run lint:fix` - Fix linting issues automatically
- `pnpm run format` - Format code with Prettier
- `pnpm run type-check` - Run TypeScript type checking

### Database

- `pnpm run db:migrate` - Run database migrations
- `pnpm run db:seed` - Seed database with sample data
- `pnpm run db:reset` - Reset database and reseed
- `pnpm run db:studio` - Open Prisma Studio for database management
- `pnpm run db:generate` - Generate Prisma client

### Docker

- `pnpm run docker:build` - Build all Docker images
- `pnpm run docker:up` - Start all services with Docker Compose
- `pnpm run docker:down` - Stop all Docker services
- `pnpm run docker:logs` - View logs from all services

## API Documentation

The API documentation is available at:

- Development: `http://localhost:3000/api/docs`
- Swagger/OpenAPI specification included in `/docs/api`

## Deployment

### Production Deployment

1. **Environment Setup**: Configure production environment variables
2. **Database**: Set up PostgreSQL and Redis instances
3. **Docker**: Use provided Docker configurations
4. **Kubernetes**: Apply manifests from `/docker/k8s/`
5. **Monitoring**: Configure logging and monitoring solutions

### Environment Variables

#### Required Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379

# Authentication
JWT_SECRET=your-secure-secret
REFRESH_SECRET=your-refresh-secret
ENCRYPTION_SALT=your-encryption-salt

# AI Integration
OPENAI_API_KEY=your-openai-key

# Code Execution
DOCKER_HOST=unix:///var/run/docker.sock

# Application
NODE_ENV=production
CLIENT_URL=https://your-domain.com
API_URL=https://api.your-domain.com
```

#### Optional Variables

```bash
# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# AI Configuration
AI_MODEL=gpt-4
AI_MAX_TOKENS=2000
AI_TEMPERATURE=0.7

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn
```

## Performance

- **Real-time Collaboration**: Optimized for 50+ concurrent users per document
- **AI Response Time**: < 3 seconds for specification reviews
- **Code Execution**: < 30 seconds timeout with resource limits
- **Database**: Optimized queries with proper indexing
- **Caching**: Redis-based caching for frequently accessed data

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:

- **Issues**: Open an issue on GitHub
- **Documentation**: Check the `/docs` directory
- **API Reference**: Available at `/api/docs`
- **Community**: Join our discussions on GitHub

## Roadmap

- [ ] Advanced AI tutoring with personalized learning paths
- [ ] Integration with popular IDEs and development tools
- [ ] Mobile application for on-the-go specification review
- [ ] Enterprise SSO and advanced team management
- [ ] Specification template marketplace
- [ ] Advanced analytics and reporting dashboard
