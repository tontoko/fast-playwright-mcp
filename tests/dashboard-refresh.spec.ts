import { expect, test } from '@playwright/test';
import { refreshDashboard } from '../src/apps/dashboard/refresh.js';

test('dashboard initializes tabs before requesting a screenshot', async () => {
  const order: string[] = [];
  const result = await refreshDashboard({
    updateTabs: () => {
      order.push('tabs');
      return Promise.resolve();
    },
    updatePreview: () => {
      order.push('preview');
      return Promise.resolve(true);
    },
  });

  expect(order).toEqual(['tabs', 'preview']);
  expect(result).toEqual({ previewAvailable: true });
});

test('dashboard refresh succeeds when image responses are omitted', async () => {
  const result = await refreshDashboard({
    updateTabs: () => Promise.resolve(),
    updatePreview: () => Promise.resolve(false),
  });

  expect(result).toEqual({ previewAvailable: false });
});
