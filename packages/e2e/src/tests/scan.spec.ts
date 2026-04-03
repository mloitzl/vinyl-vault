/**
 * Scan barcode → add to collection → delete
 *
 * This test performs a real external API lookup (Discogs + MusicBrainz) so it
 * requires an internet connection and may be slightly slower than pure UI tests.
 * Use a known, stable barcode for a well-known release to keep it deterministic.
 *
 * The test is safe even when the user already owns a copy of this record:
 * it captures the initial count in beforeEach and restores it in afterEach.
 */

import { test, expect } from '../fixtures';

const BARCODE = '5099902988313'; // The Wall — Pink Floyd
const TITLE = 'The Wall';
const ARTIST = 'Pink Floyd';

test.describe('Scan barcode', () => {
  let initialCount = 0;

  // Capture how many copies of this record exist before the test runs.
  // This makes the test safe even when the user already owns a copy.
  test.beforeEach(async ({ page }) => {
    await page.goto('/collection');
    await page.waitForLoadState('networkidle');
    initialCount = await page.getByRole('heading', { name: TITLE, level: 3 }).count();
  });

  // Restore the collection to its pre-test state by deleting any extra copies.
  test.afterEach(async ({ page }) => {
    await page.goto('/collection');
    await page.waitForLoadState('networkidle');
    const current = await page.getByRole('heading', { name: TITLE, level: 3 }).count();
    let toDelete = current - initialCount;
    while (toDelete > 0) {
      const heading = page.getByRole('heading', { name: TITLE, level: 3 }).first();
      if (!(await heading.isVisible({ timeout: 2_000 }).catch(() => false))) break;
      const card = page.getByRole('heading', { name: TITLE, level: 3 }).first().locator('../..');
      page.once('dialog', (d) => d.accept());
      await card.getByRole('button', { name: 'Delete record' }).click();
      await page.waitForTimeout(300);
      toDelete--;
    }
  });

  test('scan a known barcode, add the record to the collection, then delete it', async ({
    page,
    scanPage,
  }) => {
    await scanPage.goto();

    // ── 1. Enter the barcode and trigger the lookup ──────────────────────────
    const barcodeInput = page.getByPlaceholder('Enter or scan barcode');
    await barcodeInput.clear();
    await barcodeInput.fill(BARCODE);
    await page.getByRole('button', { name: 'Lookup' }).click();

    // ── 2. Wait for the album result ─────────────────────────────────────────
    // External API calls (Discogs + MusicBrainz) can take several seconds.
    const albumCard = page
      .getByRole('button')
      .filter({ hasText: TITLE })
      .filter({ hasText: ARTIST })
      .first();
    await expect(albumCard).toBeVisible({ timeout: 30_000 });

    // ── 3. Select the album card ──────────────────────────────────────────────
    await albumCard.click();

    // ── 4. Add to collection via the sticky action bar ────────────────────────
    const addButton = page.getByRole('button', { name: 'Add to Collection' });
    await expect(addButton).toBeVisible({ timeout: 5_000 });
    await addButton.click();

    // ── 5. Confirm success toast ──────────────────────────────────────────────
    await expect(
      page.getByText(new RegExp(`Added.*${TITLE}.*to your collection`, 'i'))
    ).toBeVisible({ timeout: 10_000 });

    // ── 6. Verify the record count increased in the collection ────────────────
    await page.goto('/collection');
    await expect(page.getByRole('heading', { name: TITLE, level: 3 })).toHaveCount(
      initialCount + 1,
      { timeout: 15_000 }
    );
    await page.waitForLoadState('networkidle');

    // ── 7. Delete the record ──────────────────────────────────────────────────
    const recordCard = page.getByRole('heading', { name: TITLE, level: 3 }).first().locator('../..');
    page.once('dialog', (d) => d.accept());
    await recordCard.getByRole('button', { name: 'Delete record' }).click();

    // ── 8. Confirm the count is back to what it was before the test ───────────
    await expect(page.getByRole('heading', { name: TITLE, level: 3 })).toHaveCount(initialCount, {
      timeout: 10_000,
    });
  });
});
