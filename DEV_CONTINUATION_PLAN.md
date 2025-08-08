## Dev continuation plan (new machine quickstart)

Use this as the single hand-off doc to resume work on another laptop or clean environment.

### 1) Quick setup

- Install Node + pnpm
  - macOS: `xcode-select --install` (if not installed)
  - Install Node LTS (nvm recommended), then enable corepack:
    ```bash
    nvm install --lts
    corepack enable && corepack prepare pnpm@latest --activate
    node -v && pnpm -v
    ```
- Clone and install deps
  ```bash
  git clone https://github.com/Grieveren/SpecDevMentor.git
  cd SpecDevMentor
  pnpm install
  ```
- Generate Prisma client (server)
  ```bash
  pnpm --filter server prisma generate
  ```

### 2) Commands you’ll use most

- Type-check all packages
  ```bash
  pnpm -w type-check
  ```
- Run server tests (unit/service + route tests)
  ```bash
  pnpm --filter server test
  ```
- Run focused tests by pattern (replace PATTERN)
  ```bash
  pnpm --filter server test -t "PATTERN"
  # e.g. pnpm --filter server test -t "auth.routes|ai-review.routes"
  ```
- Build server
  ```bash
  pnpm --filter server build
  ```

### 3) Environment & test behavior

- Most route/service tests are designed to run without external services. In test mode we:
  - Stub Redis within certain routes (`ai-review.routes.ts`, `notification.routes.ts`).
  - Avoid Docker by simulating code execution when Docker isn’t mocked (`code-execution.service.ts`).
  - Return consistent error shapes (`error` field present) in validation/auth middleware.
  - Accept both `user.id` and `user.userId` shapes in routes.
- For local runtime (not tests), copy or create `server/.env` and set required secrets (`JWT_SECRET`, `REFRESH_SECRET`, etc.)
  - Integration tests require Postgres/Redis; you can skip those initially or run the services and set `DATABASE_URL` and `REDIS_URL`.

### 4) Known gotchas (tests)

- Prisma mocking: some services use `require('@prisma/client')` to play nicely with module mocks.
- Invalid enum value: if you see `__esModule` enum issues, ensure the test mocks align with `require` usage.
- Auth responses: tests expect 401 on missing token and an `error` field in JSON.
- Validation responses: tests expect an `error` field and a `details` array.
- Code execution: when running in test mode without a Docker mock, execution is simulated; when a Docker client is mocked by tests, the real path is used.

### 5) What to fix next (checklist)

- [ ] Run full server test suite and triage any remaining failures
- [ ] Stabilize any specs still coupling to external services (prefer in-test stubs)
- [ ] Clean up TypeScript `// @ts-nocheck` sections as feasible
- [ ] Re-enable stricter ESLint rules once tests are green
- [ ] Address integration tests by providing ephemeral Postgres/Redis or mocking at the test layer

### 6) Assistant kickoff prompt (paste into Cursor on new laptop)

Copy/paste this into the coding model as your first message after opening the repo:

```
Context: I just set up the project on a new machine. Use DEV_CONTINUATION_PLAN.md as primary context.

Goals:
1) Run the full server tests and summarize current failures by cluster
2) Prioritize fixes to get the suite green; avoid relying on external services in unit/route tests
3) Keep any new changes small, with clear commit messages, and push to main

Constraints:
- Use test-time stubs where appropriate (see plan doc) and avoid Docker/DB/Redis when not explicitly mocked
- Maintain the response shape conventions for auth/validation errors (include `error` field)

Now: run `pnpm --filter server test` and show a short, grouped summary of failures.
```

### 7) Commit style

- Prefer short, conventional subjects with a clear scope, e.g.:
  - `test(stabilize): align auth error responses; add validation error field`
  - `fix(ai-review): stub redis in tests; normalize user id shape`

### 8) Troubleshooting quick refs

- Prisma Client not found: run `pnpm --filter server prisma generate`.
- Docker errors during tests: ensure tests aren’t forcing Docker paths; if mocking, keep the mock consistent.
- Enum import issues: prefer `require('@prisma/client')` in files that are mocked in tests.

That’s it—pull `main`, follow the commands above, and continue where we left off.
