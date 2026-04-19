---
description: Repo-wide coding instructions for Vinyl Vault
applyTo: '**'
---

# Vinyl Vault Copilot Instructions

## Project Shape

- This is a pnpm workspace monorepo. Main packages are `packages/frontend`, `packages/bff`, `packages/backend`, and `packages/demo-server`.
- Default stack is TypeScript with ESM modules. Keep existing relative import style, including `.js` extensions in TypeScript source where the package already uses them.
- Use `pnpm --filter <package>` for package-scoped commands inside the workspace.
- Prefer targeted changes inside the affected package instead of cross-cutting refactors.

## Package Responsibilities

- `packages/frontend`: Vite + React 18 + Relay + Tailwind SPA. The browser talks only to the BFF.
- `packages/bff`: Express + Apollo Server. Owns sessions, GitHub auth routes, JWT creation, and schema stitching.
- `packages/backend`: Apollo Server + MongoDB domain backend. Owns tenant-aware business logic, all persistent domain data writes, Typesense search adapter, and the sync worker entry point.
- `packages/demo-server`: small orchestration layer for the demo deployment. Keep it lightweight.
- Infrastructure is Kubernetes-oriented for staging/production, with Docker and GitHub Actions around that flow; the demo deployment runs on Koyeb.

## GraphQL And Relay Rules

- Preserve the current split of responsibilities: browser -> BFF -> backend. Do not add direct browser calls to the backend.
- In the BFF, prefer extending the stitched schema flow instead of duplicating backend schema definitions. BFF `schema.graphql` should stay focused on BFF-owned auth/session fields.
- In `packages/bff/src/schema.graphql`, never use `extend type` for server-provided fields. Relay treats those as client-only fields and will not fetch them.
- In the frontend, follow existing Relay patterns such as pagination fragments, connection directives, and generated artifacts.
- Do not hand-edit Relay generated files under `src/__generated__`.
- When changing frontend GraphQL operations or schema-visible types, regenerate artifacts with the existing workflow in `packages/frontend`: `pnpm update-schema` then `pnpm relay` or just the package build/prebuild flow.

## Multi-Tenant Data Rules

- Preserve tenant isolation. Backend domain data belongs in tenant databases; cross-tenant metadata belongs in the registry database.
- Use a single `MongoClient` per cluster and derive lightweight database handles with `client.db(dbName)`. Do not create a new `MongoClient` per tenant or per request.
- The BFF must not write domain records directly to MongoDB. Domain writes go through backend GraphQL or backend-owned services.
- Respect the existing tenant context model in JWT/session handling. New backend operations must validate and use tenant context rather than accepting arbitrary tenant identifiers from the client.
- `MONGODB_URI` in the BFF is for the sessions database. The backend uses `MONGODB_URI_BASE` for tenant databases and `MONGODB_REGISTRY_URI` for the registry database.

## Search (Typesense)

- Full-text search is powered by Typesense. Atlas Search has been removed entirely — do not re-introduce `$search` pipeline stages or `listSearchIndexes`/`createSearchIndex` calls.
- The search path is two-step: Typesense returns ranked IDs + facet counts → backend fetches full `RecordDocument`s from MongoDB by those IDs.
- Tenant isolation in search is enforced by `filter_by: tenantId:=\`<id>\`` on every Typesense query. The tenant ID comes from the JWT context, never from the client.
- Search services live in `packages/backend/src/services/`: `typesense.ts` (client/schema/search), `typesense-query.ts` (query builder), `typesense-highlights.ts` (highlight mapper).
- The sync worker (`packages/backend/src/sync-worker/`) keeps Typesense in sync via a single MongoDB `client.watch()` on all `vv_*` namespaces. It runs as a separate process/container (`Dockerfile.sync-worker`). Never fold sync logic into the main backend server process.
- The Typesense collection schema and any schema migrations live in `typesense.ts`. If you add a new searchable field, update `toTypesenseDoc`, the collection schema, and the sync worker's `initial-sync.ts`.
- `TYPESENSE_HOST`, `TYPESENSE_PORT`, `TYPESENSE_PROTOCOL`, and `TYPESENSE_API_KEY` are required by both the backend and the sync worker. They are read via `packages/backend/src/config/env.ts`.

## Coding Conventions

- Match the surrounding style and keep functions small unless the file already uses a different pattern.
- Prefer TypeScript strict-mode code. Avoid `any` unless it is genuinely unavoidable, and document the cast or escape hatch briefly when you use one.
- Prefer `async`/`await` over callbacks or manually chained promises.
- Prefer existing utilities, services, repositories, and logger modules over introducing parallel abstractions.
- Use pino-based package loggers instead of ad hoc `console.*` logging in production code.
- Keep comments sparse and only where the intent is non-obvious.
- Follow the lint convention for intentionally unused arguments and variables by prefixing them with `_`.

## Config And Secrets

- Prefer centralized config access through `packages/*/src/config/env.ts` rather than scattering `process.env.*` reads through application code.
- Existing exceptions such as bootstrap code, instrumentation, loggers, tests, and scripts should stay narrow; do not expand direct environment access casually.
- `JWT_SECRET` must stay identical between the BFF and backend.
- Local secrets live in `.env`; deployed secrets belong in Kubernetes Secrets or the equivalent platform secret store.

## Change Scope

- Fix the root cause in the package that owns the behavior.
- Avoid broad renames, formatting-only churn, or architectural rewrites unless the task explicitly requires them.
- Keep public API and GraphQL schema changes minimal and update dependent packages when a schema contract changes.

## Validation

- Run the smallest relevant checks for the package you changed.
- For one-off test runs, prefer `pnpm --filter <package> exec vitest run` or `npx vitest run` over `pnpm test`, which opens watch mode in this repo.
- Integration tests require a live MongoDB instance. Failures caused solely by a missing local database are expected unless the task is specifically about test infrastructure.
- Useful commands:
  - root: `pnpm build`, `pnpm lint`, `pnpm test`
  - frontend: `pnpm --filter @vinylvault/frontend lint`, `pnpm --filter @vinylvault/frontend test`
  - bff: `pnpm --filter @vinylvault/bff lint`, `pnpm --filter @vinylvault/bff test`
  - backend: `pnpm --filter @vinylvault/backend lint`, `pnpm --filter @vinylvault/backend test`

## Deployment And Config Safety

- Do not hardcode secrets, tokens, webhook secrets, or private keys in source files, docs, tests, or examples.
- Prefer documenting environment variables over embedding credentials.
- When changing deployment or infra files, preserve the distinction between local dev, Kubernetes staging/production, and the Koyeb/Vercel demo setup.

## Git Hygiene

- Prefer branch names under `bugfix/`, `feature/`, `chore/`, or `refactor/`.
- Never commit secrets, `.env` files, or generated `dist/` output.
- Prefer atomic commits scoped to a single concern.
