import { type Page, type Locator } from '@playwright/test';
import { AppPage } from './AppPage.js';

export class ScanPage extends AppPage {
  constructor(page: Page) {
    super(page);
  }

  async goto(): Promise<void> {
    await this.page.goto('/scan');
    await this.waitForAppReady();
  }

  // ── Page header ───────────────────────────────────────────────────────────

  get heading(): Locator {
    return this.page.getByRole('heading', { name: 'Scan Barcode' });
  }

  get subheading(): Locator {
    return this.page.getByText('Add a record to your collection');
  }

  // ── Barcode input ─────────────────────────────────────────────────────────
  // ScanBarcode component offers both camera scanning and manual input.

  get manualBarcodeInput(): Locator {
    return this.page.getByPlaceholder(/barcode/i);
  }
}
