import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  assertReviewThreadsReady,
  type ReviewThreadPage,
  unresolvedThreadCount,
} from '../scripts/review-threads/check.js';

async function fixture(name: string): Promise<ReviewThreadPage> {
  return JSON.parse(
    await readFile(`tests/review-threads/fixtures/${name}.json`, 'utf8')
  ) as ReviewThreadPage;
}

test('resolved ready pull request passes', async () => {
  const page = await fixture('resolved');
  expect(() => assertReviewThreadsReady(page)).not.toThrow();
});

test('unresolved draft is reported without failing', async () => {
  const page = await fixture('unresolved-draft');
  expect(unresolvedThreadCount(page)).toBe(1);
  expect(() => assertReviewThreadsReady(page)).not.toThrow();
});

test('unresolved ready pull request fails', async () => {
  const page = await fixture('unresolved-ready');
  expect(() => assertReviewThreadsReady(page)).toThrow(
    'Pull request has 1 unresolved review thread(s)'
  );
});
