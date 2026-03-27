/**
 * Two-user social feature tests.
 *
 * These tests require two authenticated GitHub test accounts:
 *   User 1: E2E_GITHUB_USERNAME / E2E_GITHUB_PASSWORD  → .auth/user.json
 *   User 2: E2E_GITHUB_USERNAME_2 / E2E_GITHUB_PASSWORD_2 → .auth/user2.json
 *
 * Prerequisites (one-time setup on the test accounts):
 *   - User 2 must have "Allow friend requests" enabled in Personal Settings.
 *     The beforeAll hook in this file ensures this automatically.
 *
 * Tests are isolated: beforeEach/afterEach remove any lingering friendship so
 * each test starts from a clean slate.
 */

import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { SocialPage } from '../pages/SocialPage';
import { AUTH_FILE_2, BASE_URL } from '../../playwright.config';

// Display name shown in the UI for each test account.
// These must match the GitHub display name of the respective accounts.
const USER1_GITHUB_LOGIN = process.env.E2E_GITHUB_USERNAME ?? 'vinylvaultuser';
const USER2_GITHUB_LOGIN = process.env.E2E_GITHUB_USERNAME_2 ?? 'vinylvaultuser1';

// ── Second user browser context ──────────────────────────────────────────────
// Module-level so beforeAll/afterAll and individual tests can share it.
let ctx2: BrowserContext;
let page2: Page;

/**
 * Open Personal Settings for the given page and ensure "Allow friend requests"
 * is checked. Leaves the modal closed when done.
 */
async function ensureAllowFriendRequestsEnabled(p: Page): Promise<void> {
  await p.goto(BASE_URL);
  await p.waitForLoadState('networkidle');

  // Open user dropdown
  const userMenuBtn = p.locator('header button[aria-haspopup="true"]').first();
  await expect(userMenuBtn).toBeVisible({ timeout: 20_000 });
  await userMenuBtn.click();

  // Open Personal Settings
  await p.getByRole('button', { name: 'Personal Settings' }).click();
  const dialog = p.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  // The checkbox is sr-only; check its state via the DOM, toggle via the label text
  const checkbox = dialog.getByRole('checkbox', { name: /allow friend requests/i });
  await expect(checkbox).toBeAttached({ timeout: 10_000 });
  if (!(await checkbox.isChecked())) {
    await dialog.getByText('Allow friend requests').click();
    // Wait for the mutation to settle before closing
    await p.waitForLoadState('networkidle');
  }

  // Close modal with the X button
  await dialog.getByRole('button', { name: 'Close modal' }).click();
  await expect(dialog).not.toBeVisible({ timeout: 5_000 });
}

/**
 * Best-effort cleanup: remove any friendship or pending request between the
 * two test users so each test starts from a clean state.
 *
 * Navigates user1's page to Social and removes user2 from friends (if present).
 * Navigates user2's page to Social and declines any request from user1 (if present).
 */
async function cleanupFriendship(user1Page: Page, user2Page: Page): Promise<void> {
  // User 1 side: remove user2 from friends if present
  try {
    const social1 = new SocialPage(user1Page);
    await social1.goto();

    const removeBtn = social1.removeFriendButton(USER2_GITHUB_LOGIN);
    if (await removeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await removeBtn.click();
      await user1Page.waitForLoadState('networkidle');
    }
  } catch {
    // ignore cleanup errors
  }

  // User 2 side: decline any pending request from user1
  try {
    const social2 = new SocialPage(user2Page);
    await social2.goto();

    const declineBtn = social2.declineButton(USER1_GITHUB_LOGIN);
    if (await declineBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await declineBtn.click();
      await user2Page.waitForLoadState('networkidle');
    }
  } catch {
    // ignore cleanup errors
  }
}

test.describe('two-user social feature', () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    if (!AUTH_FILE_2) {
      test.skip();
    }

    // Create a persistent second-user context for the entire describe block
    ctx2 = await browser.newContext({ storageState: AUTH_FILE_2 });
    page2 = await ctx2.newPage();

    // Ensure user 2 is discoverable by user 1
    await ensureAllowFriendRequestsEnabled(page2);
  });

  test.afterAll(async () => {
    await ctx2?.close();
  });

  test.beforeEach(async ({ page }) => {
    await cleanupFriendship(page, page2);
  });

  test.afterEach(async ({ page }) => {
    // Run cleanup again so the next test starts clean even if this test failed
    await cleanupFriendship(page, page2);
  });

  // ── Test 1: Notification badge ─────────────────────────────────────────────

  test('notification badge appears on Friends link when a request is received', async ({
    page,
  }) => {
    const social1 = new SocialPage(page);

    // User 1 finds user 2 by exact GitHub login and sends a friend request
    await social1.goto();
    await social1.searchInput.fill(USER2_GITHUB_LOGIN);
    await social1.searchButton.click();

    const addBtn = social1.addFriendButton(USER2_GITHUB_LOGIN);
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    // Wait for the request to be recorded
    await page.waitForLoadState('networkidle');

    // User 2 navigates to the app — the red badge should be visible on Friends nav
    await page2.goto(BASE_URL);
    await page2.waitForLoadState('networkidle');

    const social2 = new SocialPage(page2);
    const badge = social2.friendsNavBadge;
    await expect(badge).toBeVisible({ timeout: 15_000 });
    await expect(badge).toContainText(/^\d/);
  });

  // ── Test 2: Full handshake → museum mode → remove ─────────────────────────

  test('full handshake: send → accept → museum mode → remove friend', async ({ page }) => {
    const social1 = new SocialPage(page);
    const social2 = new SocialPage(page2);

    // ── Step 1: User 1 sends a friend request to user 2 ─────────────────────
    await social1.goto();
    await social1.searchInput.fill(USER2_GITHUB_LOGIN);
    await social1.searchButton.click();

    const addBtn = social1.addFriendButton(USER2_GITHUB_LOGIN);
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
    await addBtn.click();

    await expect(social1.requestSentBadge(USER2_GITHUB_LOGIN)).toBeVisible({ timeout: 10_000 });

    // ── Step 2: User 2 accepts the request ───────────────────────────────────
    await social2.goto();

    const acceptBtn = social2.acceptButton(USER1_GITHUB_LOGIN);
    await expect(acceptBtn).toBeVisible({ timeout: 15_000 });
    await acceptBtn.click();
    await page2.waitForLoadState('networkidle');

    // ── Step 3: User 1 navigates back to Social — store-and-network refreshes ─
    await social1.goto();
    // store-and-network fires a background network request; wait for it to settle
    await page.waitForLoadState('networkidle');

    // User 2 should now appear in My Friends
    const viewBtn = social1.viewCollectionButton(USER2_GITHUB_LOGIN);
    await expect(viewBtn).toBeVisible({ timeout: 15_000 });

    // ── Step 4: Museum mode ───────────────────────────────────────────────────
    await viewBtn.click();
    await page.waitForLoadState('networkidle');

    // The slate banner appears in the header when viewing a friend's collection
    const museumBanner = page.locator('div.bg-slate-50').filter({ has: page.getByText(/browsing/i) });
    await expect(museumBanner).toBeVisible({ timeout: 10_000 });
    // Banner must show the user's name and the FRIEND role badge
    await expect(museumBanner).toContainText(/browsing/i);
    await expect(museumBanner).toContainText(/collection/i);
    await expect(museumBanner.getByText('FRIEND')).toBeVisible();

    // Back button is present inside the banner
    await expect(museumBanner.getByRole('button', { name: 'Back' })).toBeVisible();

    // No edit or delete record buttons in the collection (canMutate = false)
    await expect(page.locator('[title="Edit record"]')).toHaveCount(0);
    await expect(page.locator('[title="Delete record"]')).toHaveCount(0);

    // Scan nav link is hidden for VIEWERs
    await expect(page.getByRole('link', { name: 'Scan' })).toBeHidden();

    // ── Step 5: Return to own collection ─────────────────────────────────────
    await page.getByRole('button', { name: 'Back' }).click();
    await page.waitForLoadState('networkidle');

    // Museum mode banner should be gone (the slate bg-slate-50 banner disappears)
    await expect(museumBanner).toBeHidden();

    // ── Step 6: Remove friend ─────────────────────────────────────────────────
    await social1.goto();
    await page.waitForLoadState('networkidle');

    const removeBtn = social1.removeFriendButton(USER2_GITHUB_LOGIN);
    await expect(removeBtn).toBeVisible({ timeout: 10_000 });
    await removeBtn.click();
    await page.waitForLoadState('networkidle');

    // User 2 should be gone from My Friends
    await expect(social1.removeFriendButton(USER2_GITHUB_LOGIN)).toBeHidden();
    await expect(social1.viewCollectionButton(USER2_GITHUB_LOGIN)).toBeHidden();
  });
});
