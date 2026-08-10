import { expect, test } from '@playwright/test';
import { refreshDashboard } from '../src/apps/dashboard/refresh.js';

test('dashboard initializes tabs before requesting a screenshot', async () => {
  const order: string[] = [];
  const result = await refreshDashboard({
    updateTabs: async () => {
      order.push('tabs');
    },
    updatePreview: async () => {
      order.push('preview');
      return true;
    },
  });

  expect(order).toEqual(['tabs', 'preview']);
  expect(result).toEqual({ previewAvailable: true });
});

test('dashboard refresh succeeds when image responses are omitted', async () => {
  const result = await refreshDashboard({
    updateTabs: async () => {},
    updatePreview: async () => false,
  });

  expect(result).toEqual({ previewAvailable: false });
});
