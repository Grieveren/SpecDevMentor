# CodeMentor-AI Reboot Progress

Last updated: 2025-11-24

## Current State

- Legacy `client/` and `server/` code removed. Repository now uses pnpm monorepo layout with shared tooling (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.eslintrc.cjs`, `.prettierrc`, Husky, Turbo).
- `packages/shared` exports foundational specification domain types (`SpecificationPhase`, `DocumentStatus`, `WorkflowProgress`, `ProjectSummary`, `ProjectOverview`, `CreateProjectRequest`).
- `apps/api` contains:
  - Express bootstrap (`src/index.ts`) with helmet, JSON parsing, zod-backed env (`src/config/env.ts`), and error handler middleware.
  - In-memory `ProjectService` producing fake workflow/documents (`src/services/project-service.ts`).
  - Versioned routes under `/api/v1/projects` supporting list, detail, and create (`src/routes/v1`).
  - Vitest/Supertest smoke tests (`test/app.test.ts`).
- `apps/web` includes:
  - Vite + React shell (`src/main.tsx`), React Query + Router providers, and UI shell (`src/pages/app.tsx`).
  - Project dashboard (`src/sections/project-dashboard.tsx`) that lists projects and displays workflow summary via API calls.
  - Vitest + Testing Library test with mocked fetch (`src/__tests__/app.test.tsx`).
- Quality gates all pass: `pnpm lint`, `pnpm type-check`, `pnpm test`, `pnpm build`.

## Environment Notes

- Working tree at `/Users/brettgray/Coding/SpecDevMentor`, branch `main`, unstaged changes.
- Run `pnpm install` after cloning/restart to hydrate dependencies.
- Development: `pnpm dev --filter api` for backend, `pnpm dev --filter web` for frontend.

## Next Steps

1. Add persistence: set up Prisma schema + Postgres Docker Compose, replace in-memory `ProjectService` with DB-backed implementation.
2. Extend API surface for specification workflow documents, approvals, AI review placeholders; grow shared types accordingly.
3. Enhance web app UI: integrate React Query for project detail caching, introduce document/phase views.
4. Prepare integration tests once persistence is wired (API + web flows).
