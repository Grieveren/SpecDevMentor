# Project Architecture & Standards

## Project Overview

CodeMentor AI is a comprehensive AI-powered coding mentor platform built with:

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + TypeScript (server workspace)
- **Monorepo**: pnpm workspaces with client/server separation
- **Testing**: Jest with React Testing Library
- **Code Quality**: ESLint + Prettier + Husky pre-commit hooks

## Directory Structure

```
├── client/                 # React frontend application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── services/       # API clients and external services
│   │   ├── types/          # TypeScript type definitions
│   │   ├── utils/          # Utility functions and helpers
│   │   └── __tests__/      # Component and integration tests
├── server/                 # Node.js backend application
├── packages/               # Shared packages and utilities
└── docs/                   # Project documentation
```

## Component Architecture Standards

### Component Structure

- Use functional components with TypeScript
- Export interfaces for all component props
- Use React.FC type annotation for components
- Implement proper prop destructuring with defaults

### File Naming Conventions

- Components: PascalCase (e.g., `SpecificationLayout.tsx`)
- Utilities: camelCase (e.g., `apiClient.ts`)
- Types: PascalCase interfaces (e.g., `SpecificationProject`)
- Test files: `*.test.ts` or `*.test.tsx`

### Import Organization

1. React and external libraries
2. Internal components and utilities
3. Type imports
4. Relative imports

## TypeScript Standards

- Use strict mode configuration
- Prefer interfaces over types for object shapes
- Use proper generic constraints
- Avoid `any` type - use `unknown` or proper typing
- Use optional chaining and nullish coalescing operators

## State Management

- Use React hooks for local state
- Zustand for global state management
- React Hook Form for form state
- Avoid prop drilling - use context or state management

## Styling Standards

- Tailwind CSS for all styling
- Use `cn()` utility for conditional classes
- Implement responsive design mobile-first
- Use Headless UI for complex interactive components
- Heroicons for consistent iconography
