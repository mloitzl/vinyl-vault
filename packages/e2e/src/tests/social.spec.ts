import { test, expect } from '../fixtures';

test.describe('Social page', () => {
  test('renders the page heading and main sections', async ({ socialPage }) => {
    await socialPage.goto();

    await expect(socialPage.heading).toBeVisible();
    await expect(socialPage.findUsersHeading).toBeVisible();
    await expect(socialPage.pendingRequestsHeading).toBeVisible();
    await expect(socialPage.myFriendsHeading).toBeVisible();
  });

  test('shows empty state for pending requests when there are none', async ({ socialPage }) => {
    await socialPage.goto();

    await expect(socialPage.noPendingRequestsText).toBeVisible();
  });

  test('shows empty state for friends list when there are none', async ({ socialPage }) => {
    await socialPage.goto();

    // Skip gracefully if the test account happens to have friends from prior runs
    const noFriendsVisible = await socialPage.noFriendsText.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!noFriendsVisible, 'Test account has existing friends — skipping empty-state assertion');

    await expect(socialPage.noFriendsText).toBeVisible();
  });

  test('search input is present and accepts text', async ({ socialPage }) => {
    await socialPage.goto();

    await expect(socialPage.searchInput).toBeVisible();
    await socialPage.searchInput.fill('Pink Floyd');
    await expect(socialPage.searchInput).toHaveValue('Pink Floyd');
  });

  test('searching for a non-existent user shows "no user found" message', async ({ socialPage }) => {
    await socialPage.goto();

    // Use a random string that is guaranteed not to match any GitHub username
    await socialPage.searchInput.fill('__e2e_no_such_user_xyz_42__');
    await socialPage.searchButton.click();

    await expect(socialPage.searchNoResultText).toBeVisible({ timeout: 10_000 });
  });

  test('notification badge is absent when there are no pending requests', async ({
    socialPage,
    page,
  }) => {
    await socialPage.goto();

    // If the page shows "No pending requests" the badge should not be visible
    const hasNoPending = await socialPage.noPendingRequestsText.isVisible({ timeout: 5_000 }).catch(() => false);
    test.skip(!hasNoPending, 'Test account has pending requests — skipping badge-absent assertion');

    // The notification badge is a <span> with a number inside the Friends nav link
    // When notificationCount === 0 the badge element is not rendered at all
    const badge = page.locator('a[href="/social"] span').filter({ hasText: /^\d+$/ });
    await expect(badge).not.toBeVisible();
  });
});

test.describe('Navigation — Friends link', () => {
  test('sidebar Friends link navigates to the social page', async ({
    page,
    homePage,
    socialPage,
  }) => {
    await homePage.goto();

    await homePage.navFriends.click();
    await page.waitForLoadState('networkidle');

    await expect(socialPage.heading).toBeVisible();
    await expect(page).toHaveURL(/\/social/);
  });
});
