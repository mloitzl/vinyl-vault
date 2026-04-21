/**
 * Auth setup for the second test user: log in once via GitHub OAuth, persist
 * the session to .auth/user2.json so two-user spec files can reuse it.
 *
 * Uses the same session-reuse logic as auth.setup.ts: if a valid session
 * already exists the OAuth flow is skipped entirely.
 *
 * After authentication (fresh or reused), also ensures "Allow friend requests"
 * is enabled for user2 so user1 can find them in search.
 *
 * Required environment variables (add to .env at the repo root):
 *   E2E_GITHUB_USERNAME_2  – GitHub username of the second dedicated test account
 *   E2E_GITHUB_PASSWORD_2  – Password for that account
 *
 * To force a fresh login, delete the file:
 *   rm packages/e2e/.auth/user2.json
 *
 * The resulting .auth/user2.json is gitignored — never commit it.
 */

import { test as setup, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { AUTH_FILE_2, BASE_URL, BFF_URL } from '../../playwright.config';
import { type Page } from '@playwright/test';

async function ensureAllowFriendRequestsEnabled(page: Page, userMenuButton: ReturnType<Page['locator']>): Promise<void> {
  await userMenuButton.click();
  await page.getByRole('button', { name: 'Personal Settings' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const checkbox = dialog.getByRole('checkbox', { name: /allow friend requests/i });
  await expect(checkbox).toBeAttached({ timeout: 10_000 });
  if (!(await checkbox.isChecked())) {
    await dialog.getByText('Allow friend requests').click();
    await page.waitForLoadState('networkidle', { timeout: 10_000 });
    console.log('✓ Enabled "Allow friend requests" for user2');
  } else {
    console.log('✓ "Allow friend requests" already enabled for user2');
  }
  await dialog.getByRole('button', { name: 'Close modal' }).click();
}

setup('authenticate second user via GitHub OAuth', async ({ page }) => {
  const username = process.env.E2E_GITHUB_USERNAME_2;
  const password = process.env.E2E_GITHUB_PASSWORD_2;

  if (!username || !password) {
    throw new Error(
      'E2E_GITHUB_USERNAME_2 and E2E_GITHUB_PASSWORD_2 must be set to run the two-user auth setup.\n' +
        'Add them to the .env file at the repository root.'
    );
  }

  // Ensure the .auth directory exists
  fs.mkdirSync(path.dirname(AUTH_FILE_2), { recursive: true });

  const userMenuButton = page.locator('header button[aria-haspopup="true"]').first();

  // ── Fast path: reuse the existing session if it is still valid ────────────
  if (fs.existsSync(AUTH_FILE_2)) {
    const saved = JSON.parse(fs.readFileSync(AUTH_FILE_2, 'utf-8'));
    if (saved?.cookies?.length > 0) {
      await page.context().addCookies(saved.cookies);
      await page.goto(BASE_URL);

      const loginButton = page.getByRole('button', { name: 'Sign in with GitHub' });

      const result = await Promise.race([
        userMenuButton.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'valid' as const),
        loginButton.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'expired' as const),
      ]).catch(() => 'unknown' as const);

      if (result === 'valid') {
        console.log('✓ Existing session for user2 is still valid — skipping OAuth flow');
        await ensureAllowFriendRequestsEnabled(page, userMenuButton);
        return;
      }
      console.log('⚠ Saved session for user2 has expired — performing fresh OAuth login');
    }
  }

  // ── Full OAuth flow ───────────────────────────────────────────────────────
  await page.goto(`${BFF_URL}/auth/github`);

  if (page.url().includes('github.com')) {
    const rateLimited = await page
      .getByText(/too many requests|unusually high number/i)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (rateLimited) {
      throw new Error(
        'GitHub is rate-limiting OAuth requests for user2.\n' +
          'Wait a few minutes, then run again.'
      );
    }
  }

  const loginField = page.locator('#login_field');
  const authorizeButton = page.getByRole('button', { name: /Authorize/i });

  if (await loginField.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await loginField.fill(username);
    await page.locator('#password').fill(password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  }

  if (await authorizeButton.isVisible({ timeout: 10_000 }).catch(() => false)) {
    await authorizeButton.click();
  }

  await page.waitForURL(`${BASE_URL}/**`, { timeout: 30_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 });

  await expect(userMenuButton).toBeVisible({ timeout: 20_000 });

  const state = await page.context().storageState();
  if (state.cookies.length === 0) {
    throw new Error(
      'OAuth completed for user2 but no session cookies were captured.\n' +
        `Ensure the BFF is running (${BFF_URL}) and GitHub OAuth credentials are valid.`
    );
  }

  await page.context().storageState({ path: AUTH_FILE_2 });
  console.log(`✓ Saved ${state.cookies.length} session cookie(s) to .auth/user2.json`);

  // ── Ensure user2 is discoverable ─────────────────────────────────────────
  // Done here (once, during setup) rather than in beforeAll to avoid triggering
  // OAuth re-auth during parallel test execution, which can cause rate limiting.
  await ensureAllowFriendRequestsEnabled(page, userMenuButton);
});
