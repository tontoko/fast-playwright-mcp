import { expect, test } from '@playwright/test';
import { DASHBOARD_HTML } from '../src/apps/generated/dashboard.js';

test('dashboard loads without external network requests', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    const url = request.url();
    if (!(url === 'about:blank' || url.startsWith('data:'))) {
      external.push(url);
    }
  });
  await page.setContent(DASHBOARD_HTML);
  await expect(
    page.getByRole('heading', { name: 'Browser dashboard' })
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Refresh' })).toBeVisible();
  expect(external).toEqual([]);
});
