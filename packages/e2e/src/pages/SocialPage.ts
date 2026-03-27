import { type Page, type Locator } from '@playwright/test';
import { AppPage } from './AppPage';

export class SocialPage extends AppPage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/social');
    await this.waitForAppReady();
  }

  // ── Page header ───────────────────────────────────────────────────────────

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Friends' });
  }

  // ── Find Users (search) section ───────────────────────────────────────────

  get findUsersHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Find Users' });
  }

  get searchInput(): Locator {
    return this.page.getByPlaceholder('GitHub username or email');
  }

  get searchButton(): Locator {
    return this.page.getByRole('button', { name: 'Search' });
  }

  /** Error/info text shown when a search returns no results. */
  get searchNoResultText(): Locator {
    return this.page.getByText(/no user found/i);
  }

  // ── Pending Requests section ──────────────────────────────────────────────

  get pendingRequestsHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Pending Requests' });
  }

  get noPendingRequestsText(): Locator {
    return this.page.getByText('No pending requests.');
  }

  // ── Sent Requests section ─────────────────────────────────────────────────

  get sentRequestsHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Sent Requests' });
  }

  // ── Friends section ───────────────────────────────────────────────────────

  get myFriendsHeading(): Locator {
    return this.page.getByRole('heading', { name: 'My Friends' });
  }

  get noFriendsText(): Locator {
    return this.page.getByText('No friends yet. Search for users above!');
  }
}
