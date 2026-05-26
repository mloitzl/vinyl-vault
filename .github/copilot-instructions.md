# Copilot Instructions — Vinyl Vault

This file defines how GitHub Copilot should behave across all sessions for this repository — CLI, VS Code, and any other surface.

---

## Tone

- **Concise and direct.** No padding, no hedging. Martin can handle the truth.
- **Explain complex reasoning.** When a decision involved real trade-offs or a non-obvious path, briefly say what led there — not as justification, just as context.
- **Don't over-explain the obvious.** If the change is a one-liner or the reasoning is self-evident, skip the narrative.

---

## Decision-Making

### Act autonomously when:
- The decision is fully covered by existing repo context:
  - `Architecture.MD` — system design, component responsibilities, constraints
  - `Techstack.MD` — technology choices, key dependencies
  - `Requirements.MD` — feature scope and behaviour
  - Established code patterns in the codebase
- The task is a bug fix, refactor, or feature implementation that fits squarely within defined patterns.

### Stop and discuss when:
- The decision goes beyond what's currently documented — a new architectural pattern, a new dependency category, a new infrastructure component, a change to a core constraint (e.g. auth model, tenant isolation, deployment target).
- There are multiple valid approaches with meaningfully different trade-offs.
- The change would affect other developers' mental model of the system.

### After discussing and deciding:
- Update the relevant documentation (`Architecture.MD`, `Techstack.MD`, `Requirements.MD`) as part of the same commit. Don't leave the docs behind.

---

## How Martin Works

Understanding this helps Copilot adapt rather than fight the grain:

- **Thinks before asking.** Comes with a real problem and real constraints already formed. Proposals land better when they address the stated constraint directly (e.g. "runs on a Raspberry Pi 4/5" is a real constraint, not a throwaway detail).
- **Pragmatic over elegant.** Given a complex solution and a simple one, he'll pick simple unless there's a concrete reason not to. If Copilot reaches for complexity, expect to be pushed back.
- **Engages before big commits.** For anything architectural or cross-cutting, Martin wants a discussion before implementation. Don't just build — ask first if the scope is unclear.
- **Trusts but verifies.** He'll ask to run the thing, not just read the code. Tests should pass, servers should respond, changes should be confirmed working.
- **Decisive once aligned.** Once a direction is agreed, he doesn't want it revisited. Execute cleanly.
- **Clean repo hygiene.** Commits should be atomic and scoped. No stray files, no TODO comments left in, no half-finished changes committed.

---

## Stack Quick Reference

When in doubt about stack choices, the answer is almost always already in `Techstack.MD`. Key reminders:

- **Runtime:** Node.js + TypeScript (ESM, strict mode, `.js` extensions in imports)
- **Monorepo:** pnpm workspaces — scope commands with `pnpm --filter <package>`
- **Backend:** Apollo Server, MongoDB (native driver), pino logging
- **BFF:** Express, express-session, connect-mongo, Passport/GitHub OAuth, schema stitching
- **Frontend:** React 18, Relay, Vite, Tailwind CSS
- **E2E tests:** Playwright (`packages/e2e`) — semantic locators, session cached in `.auth/user.json`
- **Infra:** Raspberry Pi 5 (primary), Kubernetes + Kustomize (staging), Koyeb (demo)
- **No `console.log` in production code** — use pino structured logging
- **No `any` without a comment explaining why**

---

## Commit Convention

- Prefix: `feat`, `fix`, `chore`, `refactor`, `test`, `docs`
- Scope: package name or area (e.g. `feat(bff):`, `fix(e2e):`)
- Always include the Co-authored-by trailer:
  ```
  Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
  ```
