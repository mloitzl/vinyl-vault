# E2E Tests — Vinyl Vault

Playwright-based end-to-end tests. Designed to be **stable against HTML/CSS changes** (no CSS selectors) and to run on a **Raspberry Pi 4/5** (ARM64).

## Quick start (local dev)

```bash
# 1. From the repo root — install deps (already done by pnpm install)
pnpm install

# 2. Install the Chromium browser (once)
pnpm --filter @vinylvault/e2e install-browsers

# 3. Start the app (separate terminal)
pnpm dev

# 4. Set credentials (see Auth section below), then run
pnpm e2e
```

## Auth setup

Tests run as an **authenticated user** by re-using a saved GitHub session.

Add these to your `.env` at the repo root (or export them):

```
E2E_GITHUB_USERNAME=your-test-github-username
E2E_GITHUB_PASSWORD=your-test-github-password
```

> **Important:** Use a dedicated test GitHub account **without 2FA**.  
> The account must have already been granted access to your Vinyl Vault instance.

The first `pnpm e2e` run automatically executes the `auth.setup.ts` project, logs in through the GitHub OAuth flow, and caches the session to `.auth/user.json` (gitignored).  
Subsequent runs reuse the cached session until it expires.

## Running on a Raspberry Pi 4/5

Playwright ships Chromium for `linux-arm64` — it downloads automatically:

```bash
pnpm --filter @vinylvault/e2e install-browsers
pnpm e2e
```

If you prefer the **system Chromium** (saves ~90 MB):

```bash
sudo apt install -y chromium-browser
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser pnpm e2e
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `E2E_BASE_URL` | `http://localhost:3000` | Frontend URL to test against |
| `E2E_BFF_URL` | `http://localhost:3001` | BFF URL (used for the OAuth login redirect) |
| `E2E_GITHUB_USERNAME` | — | GitHub test account username |
| `E2E_GITHUB_PASSWORD` | — | GitHub test account password |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` | _(bundled)_ | Override browser binary (Pi system Chromium) |

## Structure

```
packages/e2e/
├── playwright.config.ts      # Playwright configuration
├── src/
│   ├── fixtures/
│   │   └── index.ts          # Custom test fixtures (page object injection)
│   ├── pages/                # Page Object Models
│   │   ├── AppPage.ts        # Base page — header + navigation
│   │   ├── HomePage.ts
│   │   ├── CollectionPage.ts
│   │   ├── BrowsePage.ts
│   │   ├── ScanPage.ts
│   │   └── SearchPage.ts
│   └── tests/
│       ├── auth.setup.ts     # OAuth login + storageState persistence
│       ├── home.spec.ts
│       ├── collection.spec.ts
│       ├── browse.spec.ts
│       └── navigation.spec.ts
└── .auth/                    # gitignored — saved session lives here
```

## Why no CSS selectors?

All locators use the Playwright accessibility API (`getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`).  
This means tests keep working when Tailwind classes, HTML nesting, or element order changes.  
For the rare case where no semantic locator is suitable, use `data-testid` attributes.

## Adding new tests

1. Create a POM in `src/pages/` extending `AppPage`
2. Add the fixture to `src/fixtures/index.ts`
3. Write specs in `src/tests/` using `import { test, expect } from '../fixtures/index.js'`
4. Run `pnpm --filter @vinylvault/e2e typecheck` to verify types
