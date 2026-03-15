/**
 * Auth setup: log in once via GitHub OAuth, persist the session to
 * .auth/user.json so all authenticated spec files can reuse it.
 *
 * Required environment variables (add to .env at the repo root):
 *   E2E_GITHUB_USERNAME  – GitHub username of a dedicated test account
 *   E2E_GITHUB_PASSWORD  – Password for that account
 *
 * The test account must NOT have two-factor authentication enabled,
 * or you must also set E2E_GITHUB_TOTP_SECRET and install the
 * `otpauth` package to generate codes.
 *
 * Run once manually if you want to cache the session:
 *   cd packages/e2e && npx playwright test src/tests/auth.setup.ts
 *
 * The resulting .auth/user.json is gitignored — never commit it.
 */

import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

const AUTH_FILE = path.join(__dirname, '../../.auth/user.json');

setup('authenticate via GitHub OAuth', async ({ page }) => {
  const username = process.env.E2E_GITHUB_USERNAME;
  const password = process.env.E2E_GITHUB_PASSWORD;

  if (!username || !password) {
    throw new Error(
      'E2E_GITHUB_USERNAME and E2E_GITHUB_PASSWORD must be set to run the auth setup.\n' +
        'Add them to the .env file at the repository root.'
    );
  }

  // Ensure the .auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true });

  // ── Step 1: initiate the OAuth flow ──────────────────────────────────────
  // Navigate directly to the BFF (not through the Vite proxy) so a missing or
  // erroring proxy cannot silently swallow the redirect and leave the browser
  // at localhost:3000 without any session cookie.
  await page.goto('http://localhost:3001/auth/github');

  // ── Step 2: handle GitHub's login / authorize page ───────────────────────
  // GitHub may show either a combined login+authorize page or just an authorize
  // page if the browser already has a GitHub session in storageState.

  const loginField = page.locator('#login_field');
  const authorizeButton = page.getByRole('button', { name: /Authorize/i });

  // If the login form is visible we need to sign in first
  if (await loginField.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await loginField.fill(username);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }

  // After signing in GitHub may show an "Authorize application" screen
  if (await authorizeButton.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await authorizeButton.click();
  }

  // ── Step 3: wait for the authenticated app to load ───────────────────────
  // The BFF sets a session cookie and redirects back to the frontend root.
  await page.waitForURL('http://localhost:3000/**', { timeout: 30_000 });

  // Wait for all network requests (including /auth/me) to settle so the React
  // auth context has had a chance to update from the session cookie.
  await page.waitForLoadState('networkidle', { timeout: 15_000 });

  // Positive assertion: the user dropdown toggle button (aria-haspopup="true")
  // only exists in the header when the user IS authenticated. Unlike checking
  // that the sign-in button is absent (which also passes during the loading
  // spinner), this only resolves when the auth state is confirmed.
  const userMenuButton = page.locator('header button[aria-haspopup="true"]').first();
  await expect(userMenuButton).toBeVisible({ timeout: 20_000 });

  // ── Step 4: persist the session ──────────────────────────────────────────
  // Guard against saving an empty storageState — if no cookies were captured
  // the OAuth flow did not complete and subsequent tests would all fail.
  const state = await page.context().storageState();
  if (state.cookies.length === 0) {
    throw new Error(
      'OAuth completed but no session cookies were captured.\n' +
        'Ensure the BFF is running (localhost:3001) and GitHub OAuth credentials are valid.'
    );
  }

  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✓ Saved ${state.cookies.length} session cookie(s) to .auth/user.json`);
});
