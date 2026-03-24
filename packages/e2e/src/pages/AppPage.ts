import { type Page, type Locator } from '@playwright/test';

/**
 * Base page object that wraps the app shell — header and navigation.
 * All page-specific POMs extend this class.
 *
 * Design rule: use semantic/ARIA locators everywhere so tests survive
 * HTML restructuring and Tailwind class changes.
 */
export class AppPage {
  constructor(protected readonly page: Page) {}

  // ── Header ──────────────────────────────────────────────────────────────────

  get signInButton(): Locator {
    return this.page.getByRole('button', { name: 'Sign in with GitHub' });
  }

  // ── Desktop sidebar navigation ────────────────────────────────────────────
  // React Router's <Link> renders as <a>, so role = 'link'

  get navHome(): Locator {
    return this.page.getByRole('link', { name: 'Home' });
  }

  get navCollection(): Locator {
    return this.page.getByRole('link', { name: 'Collection' });
  }

  get navBrowse(): Locator {
    return this.page.getByRole('link', { name: 'Browse' });
  }

  get navSearch(): Locator {
    return this.page.getByRole('link', { name: 'Search' });
  }

  get navScan(): Locator {
    return this.page.getByRole('link', { name: 'Scan' });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  async goto(path: string): Promise<void> {
    await this.page.goto(path);
  }

  /** Wait until the page is no longer in a loading / suspense state. */
  async waitForAppReady(): Promise<void> {
    // The global loading spinner is the last thing shown during Relay suspension.
    // Wait for it to disappear (or for it to never appear).
    await this.page.waitForLoadState('networkidle');
  }

  currentUrl(): string {
    return this.page.url();
  }
}
