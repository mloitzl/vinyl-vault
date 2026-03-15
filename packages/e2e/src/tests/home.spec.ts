import { test, expect } from '../fixtures/index.js';

/**
 * Home page tests — run with the authenticated session.
 *
 * The home page shows personalised content when logged in:
 * quick-action cards for Scan, Collection, Browse and Search.
 */
test.describe('Home page (authenticated)', () => {
  test('shows the main action cards', async ({ homePage }) => {
    await homePage.goto();

    await expect(homePage.scanBarcodeCard).toBeVisible();
    await expect(homePage.myCollectionCard).toBeVisible();
    await expect(homePage.browseCard).toBeVisible();
    await expect(homePage.searchCard).toBeVisible();
  });

  test('navigates to Collection when the My Collection card is clicked', async ({
    homePage,
    collectionPage,
  }) => {
    await homePage.goto();
    await homePage.myCollectionCard.click();

    await expect(collectionPage.heading).toBeVisible();
  });

  test('navigates to Scan when the Scan Barcode card is clicked', async ({
    homePage,
    scanPage,
  }) => {
    await homePage.goto();
    await homePage.scanBarcodeCard.click();

    await expect(scanPage.heading).toBeVisible();
  });

  test('navigates to Browse when the Browse card is clicked', async ({
    homePage,
    browsePage,
  }) => {
    await homePage.goto();
    await homePage.browseCard.click();

    await expect(browsePage.heading).toBeVisible();
  });

  test('does NOT show the GitHub sign-in button when logged in', async ({ homePage }) => {
    await homePage.goto();

    await expect(homePage.signInButton).not.toBeVisible();
  });

  test('sidebar navigation links are present', async ({ homePage }) => {
    await homePage.goto();

    await expect(homePage.navCollection).toBeVisible();
    await expect(homePage.navBrowse).toBeVisible();
    await expect(homePage.navSearch).toBeVisible();
    await expect(homePage.navScan).toBeVisible();
  });
});
