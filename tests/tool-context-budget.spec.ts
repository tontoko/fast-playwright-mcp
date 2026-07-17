import { expect, test } from '@playwright/test';
import {
  assertToolCatalogBudget,
  measureToolCatalogs,
} from '../benchmark/tool-catalog.js';

test('adaptive tools/list remains within the context budget', () => {
  const report = measureToolCatalogs();
  expect(() => assertToolCatalogBudget(report)).not.toThrow();
  expect(report.adaptive.toolCount).toBe(7);
  expect(report.minimal.toolCount).toBe(3);
  expect(report.adaptive.bytes).toBeLessThanOrEqual(12_000);
  expect(report.adaptive.bytes).toBeLessThanOrEqual(report.full.bytes * 0.25);
});
