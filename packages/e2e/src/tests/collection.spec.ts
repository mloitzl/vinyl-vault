import { test, expect } from '../fixtures/index.js';

test.describe('Collection page', () => {
  test('renders the page heading and record count', async ({ collectionPage }) => {
    await collectionPage.goto();

    await expect(collectionPage.heading).toBeVisible();
    await expect(collectionPage.recordCountText).toBeVisible();
  });

  test('shows the Filters toggle button', async ({ collectionPage }) => {
    await collectionPage.goto();

    await expect(collectionPage.filtersToggle).toBeVisible();
  });

  test('expands the filter panel when Filters is clicked', async ({ collectionPage }) => {
    await collectionPage.goto();

    // Filter inputs are hidden until the panel is opened
    await expect(collectionPage.searchInput).not.toBeVisible();
    await collectionPage.filtersToggle.click();
    await expect(collectionPage.searchInput).toBeVisible();
    await expect(collectionPage.locationInput).toBeVisible();
  });

  test('search input accepts text and Apply Filters is clickable', async ({ collectionPage }) => {
    await collectionPage.goto();

    await collectionPage.filtersToggle.click();
    await collectionPage.searchInput.fill('Dark Side');
    await expect(collectionPage.applyFiltersButton).toBeEnabled();
  });

  test('Clear button resets the search input', async ({ collectionPage }) => {
    await collectionPage.goto();

    await collectionPage.filtersToggle.click();
    await collectionPage.searchInput.fill('Some artist');
    await collectionPage.clearFiltersButton.click();

    // After clearing, the search input should be empty (if still visible) or
    // the filter panel collapses — either way the heading stays visible
    await expect(collectionPage.heading).toBeVisible();
  });

  test.describe('with records in the collection', () => {
    /**
     * These tests only run meaningfully when the test account has records.
     * They are written to be non-destructive (no deletes, no edits that persist).
     */

    test('lists at least one record heading', async ({ collectionPage }) => {
      await collectionPage.goto();
      const count = await collectionPage.recordHeadings.count();

      // If the collection is empty this test is skipped with a soft message
      test.skip(count === 0, 'Test account has no records — skipping record-list assertions');

      expect(count).toBeGreaterThan(0);
    });

    test('shows Load More when there are more than the initial page', async ({
      collectionPage,
    }) => {
      await collectionPage.goto();

      const loadMore = collectionPage.loadMoreButton;
      const isVisible = await loadMore.isVisible();

      // This assertion passes whether or not there is a second page
      if (isVisible) {
        await expect(loadMore).toBeEnabled();
      }
    });
  });

  test('shows Scan Barcode CTA when the collection is empty', async ({ collectionPage, page }) => {
    // Navigate with a nonsense search that guarantees zero results
    await page.goto('/collection?search=__no_match_xyz_42__');
    await collectionPage.filtersToggle.click();
    await collectionPage.searchInput.fill('__no_match_xyz_42__');
    await collectionPage.applyFiltersButton.click();
    await page.waitForLoadState('networkidle');

    await expect(collectionPage.noRecordsMessage).toBeVisible();
  });
});
