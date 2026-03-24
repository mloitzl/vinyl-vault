/**
 * Auth setup: log in once via GitHub OAuth, persist the session to
 * .auth/user.json so all authenticated spec files can reuse it.
 *
 * The setup is SKIPPED when a valid session already exists in .auth/user.json
 * — the saved cookies are loaded, the app is opened, and if the user menu is
 * visible the OAuth flow is bypassed entirely. This avoids GitHub rate-limiting
 * the OAuth endpoint when you run `pnpm e2e` repeatedly.
 *
 * Required environment variables (add to .env at the repo root):
 *   E2E_GITHUB_USERNAME  – GitHub username of a dedicated test account
 *   E2E_GITHUB_PASSWORD  – Password for that account
 *
 * The test account must NOT have two-factor authentication enabled,
 * or you must also set E2E_GITHUB_TOTP_SECRET and install the
 * `otpauth` package to generate codes.
 *
 * To force a fresh login (e.g. after the session expires), delete the file:
 *   rm packages/e2e/.auth/user.json
 *
 * The resulting .auth/user.json is gitignored — never commit it.
 */

import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { AUTH_FILE, BASE_URL, BFF_URL } from '../../playwright.config';

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

  // ── Fast path: reuse the existing session if it is still valid ────────────
  // Load the saved cookies into the browser and navigate to the app. Wait for
  // either the user menu (session still valid) or the sign-in button (expired).
  // This avoids a GitHub OAuth round-trip on every test run and prevents the
  // OAuth endpoint from being rate-limited by repeated authorisation requests.
  if (fs.existsSync(AUTH_FILE)) {
    const saved = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    if (saved?.cookies?.length > 0) {
      await page.context().addCookies(saved.cookies);
      await page.goto(BASE_URL);

      const userMenu = page.locator('header button[aria-haspopup="true"]').first();
      const loginButton = page.getByRole('button', { name: 'Sign in with GitHub' });

      // Race: whichever becomes visible first tells us the session state
      const result = await Promise.race([
        userMenu.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'valid' as const),
        loginButton.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'expired' as const),
      ]).catch(() => 'unknown' as const);

      if (result === 'valid') {
        console.log('✓ Existing session is still valid — skipping OAuth flow');
        return;
      }
      console.log('⚠ Saved session has expired — performing fresh OAuth login');
    }
  }

  // ── Full OAuth flow ───────────────────────────────────────────────────────
  // Navigate directly to the BFF (not through the Vite proxy) so a missing or
  // erroring proxy cannot silently swallow the redirect and leave the browser
  // at the frontend URL without any session cookie.
  await page.goto(`${BFF_URL}/auth/github`);

  // Detect GitHub rate-limiting before attempting any interaction.
  // GitHub returns "Too many requests" or a reauthorization warning when the
  // OAuth endpoint is called too frequently from the same account.
  if (page.url().includes('github.com')) {
    const rateLimited = await page
      .getByText(/too many requests|unusually high number/i)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (rateLimited) {
      throw new Error(
        'GitHub is rate-limiting OAuth requests for this account.\n' +
          'Wait a few minutes, then run again. The existing session in\n' +
          '.auth/user.json will be reused automatically once it is valid.'
      );
    }
  }

  // ── Handle GitHub's login / authorize page ────────────────────────────────
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

  // ── Wait for the authenticated app to load ────────────────────────────────
  // The BFF sets a session cookie and redirects back to the frontend root.
  await page.waitForURL(`${BASE_URL}/**`, { timeout: 30_000 });

  // Wait for all network requests (including /auth/me) to settle so the React
  // auth context has had a chance to update from the session cookie.
  await page.waitForLoadState('networkidle', { timeout: 15_000 });

  // Positive assertion: the user dropdown toggle button (aria-haspopup="true")
  // only exists in the header when the user IS authenticated. Unlike checking
  // that the sign-in button is absent (which also passes during the loading
  // spinner), this only resolves when the auth state is confirmed.
  const userMenuButton = page.locator('header button[aria-haspopup="true"]').first();
  await expect(userMenuButton).toBeVisible({ timeout: 20_000 });

  // ── Persist the session ───────────────────────────────────────────────────
  // Guard against saving an empty storageState — if no cookies were captured
  // the OAuth flow did not complete and subsequent tests would all fail.
  const state = await page.context().storageState();
  if (state.cookies.length === 0) {
    throw new Error(
      'OAuth completed but no session cookies were captured.\n' +
        `Ensure the BFF is running (${BFF_URL}) and GitHub OAuth credentials are valid.`
    );
  }

  await page.context().storageState({ path: AUTH_FILE });
  console.log(`✓ Saved ${state.cookies.length} session cookie(s) to .auth/user.json`);
});
