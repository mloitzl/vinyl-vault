import { type Page, type Locator } from '@playwright/test';
import { AppPage } from './AppPage.js';

type BrowseTab = 'Artists' | 'Albums' | 'Genres';

export class BrowsePage extends AppPage {
  constructor(page: Page) {
    super(page);
  }

  async open(tab?: BrowseTab): Promise<void> {
    const url = tab ? `/browse?tab=${tab.toLowerCase()}` : '/browse';
    await this.page.goto(url);
    await this.waitForAppReady();
  }

  // ── Header ────────────────────────────────────────────────────────────────

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Browse' });
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────
  // The tab strip renders plain <button> elements (not a role="tab" component)

  tab(name: BrowseTab): Locator {
    return this.page.getByRole('button', { name });
  }

  async switchToTab(name: BrowseTab): Promise<void> {
    await this.tab(name).click();
    await this.waitForAppReady();
  }

  // ── Content ───────────────────────────────────────────────────────────────

  /** Artist name links rendered in the Artists tab. */
  get artistLinks(): Locator {
    return this.page.getByRole('link').filter({ hasText: /.+/ });
  }

  /** Per-album copy badges in the Albums tab (one badge per album card). */
  get albumCards(): Locator {
    return this.page.getByText(/\d+\s+cop(y|ies)/i);
  }

  /** Genre pill/button items in the Genres tab. */
  get genreItems(): Locator {
    return this.page.getByRole('button').filter({ hasText: /.+/ });
  }
}
