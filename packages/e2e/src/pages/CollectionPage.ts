import { type Page, type Locator } from '@playwright/test';
import { AppPage } from './AppPage.js';

export class CollectionPage extends AppPage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/collection');
    await this.waitForAppReady();
  }

  // ── Page header ───────────────────────────────────────────────────────────

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'My Collection' });
  }

  /** "N records" subtitle beneath the heading. */
  get recordCountText(): Locator {
    return this.page.getByText(/\d+ records?/);
  }

  // ── Filters panel ─────────────────────────────────────────────────────────

  get filtersToggle(): Locator {
    return this.page.getByRole('button', { name: 'Filters' });
  }

  // The custom Input component renders a <label> without htmlFor, so
  // getByLabel doesn't work. Use placeholder text instead.
  get searchInput(): Locator {
    return this.page.getByPlaceholder('Search notes, condition, location...');
  }

  get locationInput(): Locator {
    return this.page.getByPlaceholder('Filter by location...');
  }

  get applyFiltersButton(): Locator {
    return this.page.getByRole('button', { name: 'Apply Filters' });
  }

  get clearFiltersButton(): Locator {
    return this.page.getByRole('button', { name: 'Clear' });
  }

  // ── Record list ───────────────────────────────────────────────────────────

  /**
   * All record title headings on the page.
   * RecordCard renders titles as <h3> elements.
   */
  get recordHeadings(): Locator {
    return this.page.getByRole('heading', { level: 3 });
  }

  /** Find a record card by its album title. */
  recordCardByTitle(title: string): Locator {
    return this.page.getByRole('heading', { name: title, level: 3 }).locator('../..');
  }

  /** Edit button inside a record card (identified by its title attribute). */
  editButtonFor(recordTitle: string): Locator {
    return this.recordCardByTitle(recordTitle).getByRole('button', { name: 'Edit record' });
  }

  /** Delete button inside a record card. */
  deleteButtonFor(recordTitle: string): Locator {
    return this.recordCardByTitle(recordTitle).getByRole('button', { name: 'Delete record' });
  }

  get loadMoreButton(): Locator {
    return this.page.getByRole('button', { name: 'Load More' });
  }

  /** CTA shown when the collection is empty. */
  get emptyScanButton(): Locator {
    return this.page.getByRole('button', { name: 'Scan Barcode' });
  }

  get noRecordsMessage(): Locator {
    return this.page.getByText('No records found');
  }

  // ── Edit modal ────────────────────────────────────────────────────────────

  get editModal(): Locator {
    return this.page.getByRole('dialog');
  }

  get editModalSaveButton(): Locator {
    return this.editModal.getByRole('button', { name: /Save/i });
  }

  get editModalCancelButton(): Locator {
    return this.editModal.getByRole('button', { name: /Cancel/i });
  }
}
