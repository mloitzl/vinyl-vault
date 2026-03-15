import { test, expect } from '../fixtures/index.js';

test.describe('Scan page', () => {
  test('renders the page heading and sub-heading', async ({ scanPage }) => {
    await scanPage.goto();

    await expect(scanPage.heading).toBeVisible();
    await expect(scanPage.subheading).toBeVisible();
  });
});

test.describe('Search page', () => {
  test('renders the page heading', async ({ searchPage }) => {
    await searchPage.goto();

    await expect(searchPage.heading).toBeVisible();
  });

  test('search input is present and accepts text', async ({ searchPage }) => {
    await searchPage.goto();

    await expect(searchPage.searchInput).toBeVisible();
    await searchPage.searchInput.fill('Pink Floyd');
    await expect(searchPage.searchInput).toHaveValue('Pink Floyd');
  });
});

test.describe('Navigation', () => {
  test('sidebar links navigate to the correct pages', async ({
    page,
    homePage,
    collectionPage,
    browsePage,
  }) => {
    await homePage.goto();

    // Collection
    await homePage.navCollection.click();
    await expect(collectionPage.heading).toBeVisible();

    // Browse
    await homePage.navBrowse.click();
    await expect(browsePage.heading).toBeVisible();

    // Home
    await homePage.navHome.click();
    await expect(page).toHaveURL('/');
  });
});
