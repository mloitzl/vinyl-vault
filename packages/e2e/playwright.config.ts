import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from the repo root so E2E_* variables are available locally
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const isCI = !!process.env.CI;

// On Raspberry Pi you can point this at the system Chromium to avoid
// downloading the bundled browser:
//   PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser npx playwright test
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined;

export const AUTH_FILE = path.join(__dirname, '.auth/user.json');

export default defineConfig({
  testDir: './src/tests',
  fullyParallel: false,
  forbidOnly: isCI,
  // Retry flaky tests once in CI; no retries locally so failures surface quickly
  retries: isCI ? 1 : 0,
  // Single worker on low-memory hardware (Pi 4 has 4-8 GB but browser is heavy)
  workers: isCI ? 1 : 2,
  reporter: [['html', { open: 'never', outputFolder: 'playwright-report' }], ['list']],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    // Capture a trace on the first retry so failures are debuggable
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Generous timeout for slow hardware like a Pi 4
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    ...(executablePath ? { executablePath } : {}),
  },

  projects: [
    // ── 1. Auth setup ──────────────────────────────────────────────────────────
    // Runs auth.setup.ts once to log in through GitHub OAuth and persist the
    // session to .auth/user.json. Subsequent authenticated tests reuse it.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        ...(executablePath ? { executablePath } : {}),
      },
    },

    // ── 2. Authenticated tests ─────────────────────────────────────────────────
    // All spec files under src/tests/ run here with the saved session.
    {
      name: 'chromium',
      testMatch: /\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: AUTH_FILE,
        ...(executablePath ? { executablePath } : {}),
      },
      dependencies: ['setup'],
    },
  ],

  // Global timeout per test — keep generous for Pi
  timeout: 60_000,
});
