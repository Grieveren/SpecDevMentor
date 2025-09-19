# Repository Guidelines

## Project Structure & Module Organization

- `client/` React + Vite single-page app; main entry `src/main.tsx`; UI tests under `src/**/*.test.ts(x)` and stories co-located.
- `server/` Express services with Prisma; HTTP handlers live in `src/api`; integration tests under `src/**/*.spec.ts`.
- `shared/` cross-cutting TypeScript types and utilities consumed by both runtimes.
- `e2e/` Playwright suites (`*.spec.ts`) orchestrate browser and API checks; call `pnpm test:e2e`.
- `scripts/`, `docker/`, and `k8s/` hold automation, container, and deployment assets; check `docs/` for feature-specific handbooks.

## Build, Test, and Development Commands

- `pnpm install` sets up the monorepo workspaces; rerun when dependencies change.
- `pnpm dev` runs client and server together with hot reload (ports 5173/3001).
- `pnpm build` performs type-check, lints, and creates production bundles for both packages.
- `pnpm test`, `pnpm test:watch`, and `pnpm test:e2e` cover unit, watch mode, and Playwright regression; target suites with `pnpm --filter client test`.
- `pnpm lint`, `pnpm type-check`, and `pnpm format:check` keep code quality gates green before opening a PR.

## Coding Style & Naming Conventions

TypeScript is required across the repo; prefer explicit interfaces over `any` and honour ESLint warnings. Prettier enforces 2-space indentation, 100-character line width, single quotes, and arrow functions without parentheses on single params. Use kebab-case for folders, PascalCase for components, and camelCase for variables/functions. Keep modules cohesive—group React hooks under `client/src/hooks` and services under `server/src/services`.

## Testing Guidelines

Unit and integration tests use Vitest with `*.test.ts`/`*.spec.ts` naming; co-locate them with the code they verify. Aim to maintain or improve coverage, especially for routes, services, and shared validators. Use Playwright specs in `e2e/` for end-to-end flows; smoke checks live under `e2e/smoke.spec.ts`. Before merging, run `pnpm test:e2e:run smoke` when touching auth or session logic, and consult `UAT_TESTING_GUIDE.md` for extended scenarios.

## Commit & Pull Request Guidelines

Commits follow conventional prefixes (`feat:`, `fix(server):`, `docs:`) with optional scopes that match workspace directories. Write imperative subjects under 70 characters and detail rationale in the body when behavior changes. PRs should link to tracking issues, list verification commands, and include screenshots for UI updates. Ensure CI-critical scripts (`pnpm build`, `pnpm test:e2e`) pass locally and note any follow-up tasks in the description.

## Environment & Security Notes

Copy `.env.example` to `.env` and keep secrets out of version control. Use `pnpm start` only after `pnpm build` to mimic production. When working with external services (Postgres, Redis, OpenAI), prefer the docker-compose profiles (`pnpm docker:full`) and never commit API keys or seed data containing sensitive information.
