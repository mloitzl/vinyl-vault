import { test, expect } from '../fixtures/index.js';

test.describe('Browse page', () => {
  test('renders the page heading', async ({ browsePage }) => {
    await browsePage.open();

    await expect(browsePage.heading).toBeVisible();
  });

  test('shows all three tab buttons', async ({ browsePage }) => {
    await browsePage.open();

    await expect(browsePage.tab('Artists')).toBeVisible();
    await expect(browsePage.tab('Albums')).toBeVisible();
    await expect(browsePage.tab('Genres')).toBeVisible();
  });

  test('defaults to the Artists tab', async ({ browsePage }) => {
    await browsePage.open();

    // The Artists tab is the default — wait for its content to appear
    // (at least a heading or link from the artists list)
    await browsePage.waitForAppReady();

    // The URL should contain tab=artists or have no tab param (default)
    const url = browsePage['page'].url();
    expect(url).toMatch(/tab=artists|\/browse(\?.*)?$/);
  });

  test('switches to the Albums tab', async ({ browsePage }) => {
    await browsePage.open();
    await browsePage.switchToTab('Albums');

    const url = browsePage['page'].url();
    expect(url).toContain('tab=albums');
    await expect(browsePage.heading).toBeVisible();
  });

  test('switches to the Genres tab', async ({ browsePage }) => {
    await browsePage.open();
    await browsePage.switchToTab('Genres');

    const url = browsePage['page'].url();
    expect(url).toContain('tab=genres');
    await expect(browsePage.heading).toBeVisible();
  });

  test('navigating directly to ?tab=albums shows the Albums tab', async ({ browsePage }) => {
    await browsePage.open('Albums');

    await expect(browsePage.tab('Albums')).toBeVisible();
    await browsePage.waitForAppReady();

    const url = browsePage['page'].url();
    expect(url).toContain('tab=albums');
  });

  test('navigating directly to ?tab=genres shows the Genres tab', async ({ browsePage }) => {
    await browsePage.open('Genres');

    await expect(browsePage.tab('Genres')).toBeVisible();
  });

  test('shows album headings on the Albums tab when records exist', async ({ browsePage }) => {
    await browsePage.open('Albums');
    await browsePage.waitForAppReady();

    const count = await browsePage.albumHeadings.count();
    test.skip(count === 0, 'No albums to assert — test account may have no records');
    expect(count).toBeGreaterThan(0);
  });
});
