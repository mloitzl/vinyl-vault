import { type Page, type Locator } from '@playwright/test';
import { AppPage } from './AppPage.js';

export class SearchPage extends AppPage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/search');
    await this.waitForAppReady();
  }

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Search' });
  }

  // The search input has no <label>, so we identify it by placeholder text
  get searchInput(): Locator {
    return this.page.getByPlaceholder('Search by artist, album, or barcode...');
  }

  get resultHeadings(): Locator {
    return this.page.getByRole('heading', { level: 3 });
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
    await this.page.keyboard.press('Enter');
    await this.waitForAppReady();
  }
}
