import { test as base } from '@playwright/test';
import { HomePage } from '../pages/HomePage.js';
import { CollectionPage } from '../pages/CollectionPage.js';
import { BrowsePage } from '../pages/BrowsePage.js';
import { ScanPage } from '../pages/ScanPage.js';
import { SearchPage } from '../pages/SearchPage.js';

/**
 * Extended test fixture that injects typed Page Object Models.
 *
 * Usage:
 *   import { test, expect } from '../fixtures/index.js';
 *
 *   test('collection loads', async ({ collectionPage }) => {
 *     await collectionPage.goto();
 *     await expect(collectionPage.heading).toBeVisible();
 *   });
 */
export const test = base.extend<{
  homePage: HomePage;
  collectionPage: CollectionPage;
  browsePage: BrowsePage;
  scanPage: ScanPage;
  searchPage: SearchPage;
}>({
  homePage: async ({ page }, use) => {
    await use(new HomePage(page));
  },
  collectionPage: async ({ page }, use) => {
    await use(new CollectionPage(page));
  },
  browsePage: async ({ page }, use) => {
    await use(new BrowsePage(page));
  },
  scanPage: async ({ page }, use) => {
    await use(new ScanPage(page));
  },
  searchPage: async ({ page }, use) => {
    await use(new SearchPage(page));
  },
});

export { expect } from '@playwright/test';
