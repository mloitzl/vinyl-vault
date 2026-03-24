import { type Page, type Locator } from '@playwright/test';
import { AppPage } from './AppPage';

export class HomePage extends AppPage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.waitForAppReady();
  }

  // ── Unauthenticated state ─────────────────────────────────────────────────

  get welcomeHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Welcome to Vinyl Vault' });
  }

  get signInHint(): Locator {
    return this.page.getByText('Sign in with GitHub to get started');
  }

  // ── Authenticated state ───────────────────────────────────────────────────

  // Home page action cards are <button> elements with a title and a subtitle.
  // We identify each card by its unique subtitle text, which is far more stable
  // than the accessible name (which includes all nested text + icon titles).

  get scanBarcodeCard(): Locator {
    return this.page.getByRole('button').filter({ hasText: 'Add a new record to your collection' });
  }

  get myCollectionCard(): Locator {
    return this.page.getByRole('button').filter({ hasText: 'Browse your vinyl records' });
  }

  get browseCard(): Locator {
    return this.page.getByRole('button').filter({ hasText: 'By artist, album or genre' });
  }

  get searchCard(): Locator {
    return this.page.getByRole('button').filter({ hasText: 'Find specific records' });
  }

  /** Quick-stats grid (mobile only, but still in the DOM for narrow viewports). */
  get recordCountStat(): Locator {
    return this.page.getByText('Records').first();
  }
}
