# Stabilization Roadmap

## Cleanup Backlog (In Progress)

- Status overview:
  - Remove `@ts-nocheck` overrides – **in progress** (client workspace now clean and type-safe; server middleware/services still carry targeted suppressions)
  - Cull duplicate/exploratory entry points and scripts – **completed** (legacy simple client entry points and ad-hoc auth test scripts removed)
  - Stabilize integration-test infrastructure – **not started**

1. **Remove `@ts-nocheck` overrides**
   - Scope: server/service layer, client entry points, stores, and shared utilities where suppression hides real type debt.
   - Progress: client application now compiles without overrides; introduced typed error-normalisation and notification helpers so lint rules can be re-enabled. Server middleware/routes still need type-safe request handling (auth middleware, specification workflow services).
   - Definition of done: eslint rule `@typescript-eslint/ban-ts-comment` passes without suppressions; type errors resolved or intentionally annotated with `@ts-expect-error` plus rationale.
2. **Cull duplicate or exploratory entry points and scripts**

- Completed: retired the `main-simple`/`App-simple` client boot path, removed the redundant `start-simple-production.sh` runner, and replaced the unaudited root-level auth validation scripts so helper tooling relies on the primary entries.
- Goal: single authoritative boot path for client/server and reduced cognitive load when onboarding.

3. **Stabilize integration-test infrastructure**
   - Provide disposable Postgres + Redis (Docker Compose profile or scripts), seed minimal fixtures, and gate heavier suites behind opt-in flag.
   - Ensure `pnpm --filter server test` reports green when backing services are available; document quick-start.

## Production-Ready Stabilization Plan

1. **Runtime Environment Hardening**
   - Provision consistent local stack via Docker (Postgres, Redis, mail catcher, optional worker processes).
   - Automate migrations (`db:migrate`), seeds, and health checks; bake into `scripts/start-production-local.sh`.
2. **API & Feature Completeness Audit**
   - Cross-reference specification documents with implemented routes/services; close gaps flagged by integration tests or marked TODOs.
   - Validate AI review, workflow transitions, collaboration tools, and analytics flows end-to-end.
3. **Quality Gates & Observability**
   - Restore linting (post `@ts-nocheck` removal), enforce type-check and unit/integration suites in CI.
   - Add structured logging defaults, runtime config validation, and tighten error handling (especially around Prisma and Redis failures).
   - Analytics HTTP routes now validate request payloads via typed Joi middleware; replicate the pattern across remaining route modules.
4. **UAT Readiness Checklist**
   - Produce seeded demo tenant with representative data and accounts.
   - Document UAT playbook (launch commands, expected URLs, test credentials, feature toggles).
   - Capture rollback & troubleshooting guidance in docs/runbooks/.
5. **Release Packaging**
   - Build and publish versioned Docker images (client, server) or provide scripts for local production mimic.
   - Verify build artifacts (`pnpm build`) and smoke-test start scripts before tagging release.

_Status:_ Cleanup backlog is underway (kickoff below). Remaining stabilization items require dedicated follow-up once foundational cleanup reduces noise.
