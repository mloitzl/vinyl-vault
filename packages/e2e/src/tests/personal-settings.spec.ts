/**
 * Personal Settings modal
 *
 * Regression guard for the bug where toggling a setting caused the modal to
 * close immediately (root cause: refreshUser() called setIsLoading(true),
 * which swapped <UserDropdownMenu> for a spinner, unmounting the component
 * and destroying the showPersonalSettings state).
 *
 * Fixed by: refreshUser(silent=true) skips setIsLoading when called from
 * inside the modal.
 */

import { test, expect } from '../fixtures';

async function openPersonalSettings(page: import('@playwright/test').Page) {
  const userMenuButton = page.locator('header button[aria-haspopup="true"]').first();
  await expect(userMenuButton).toBeVisible({ timeout: 15_000 });
  await userMenuButton.click();
  // "Personal Settings" is a <button> inside the dropdown, not a menuitem
  await page.getByRole('button', { name: 'Personal Settings' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 5_000 });
  return dialog;
}

test.describe('Personal Settings modal', () => {
  test('opens from the user dropdown menu', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const dialog = await openPersonalSettings(page);
    await expect(dialog).toBeVisible();
  });

  test('stays open after toggling "Allow friend requests"', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const dialog = await openPersonalSettings(page);

    // Click the toggle for "Allow friend requests" — the label is the
    // visible text rendered by ToggleRow inside PersonalSettingsModal
    await dialog.getByText('Allow friend requests').click();

    // ── Regression check ─────────────────────────────────────────────────────
    // The dialog must still be visible after the toggle fires the mutation and
    // refreshUser() is called. If setIsLoading(true) were called the header
    // would re-render, the dropdown component would unmount and the dialog
    // would disappear.
    await expect(dialog).toBeVisible({ timeout: 10_000 });
  });

  test('closes when the X button is clicked', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const dialog = await openPersonalSettings(page);

    // The Modal component renders a close button with aria-label="Close modal"
    await dialog.getByRole('button', { name: 'Close modal' }).click();

    await expect(dialog).not.toBeVisible({ timeout: 5_000 });
  });
});
