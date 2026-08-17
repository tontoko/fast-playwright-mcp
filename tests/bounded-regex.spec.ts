import { expect, test } from '@playwright/test';
import {
  REGEX_SEARCH_TIMEOUT_ERROR,
  regexMatchedLineIndices,
} from '../src/utils/bounded-regex.js';

test('bounded regex matcher returns matching line indices', async () => {
  const lines = [
    '- button "Save changes"',
    '- heading "Settings"',
    '- textbox',
  ];
  await expect(
    regexMatchedLineIndices(lines, 'save|heading', 'iu')
  ).resolves.toEqual([0, 1]);
  await expect(regexMatchedLineIndices(lines, 'save', 'u')).resolves.toEqual(
    []
  );
});

test('bounded regex matcher reports invalid patterns', async () => {
  await expect(regexMatchedLineIndices(['line'], '(', 'u')).rejects.toThrow(
    'Invalid regular expression'
  );
});

test('catastrophic backtracking is terminated by the time budget', async ({
  page: _page,
}) => {
  const longLine = `${'a'.repeat(80)}b`;
  const startedAt = Date.now();
  await expect(
    regexMatchedLineIndices([longLine], '^(a+)+$', 'u')
  ).rejects.toThrow(REGEX_SEARCH_TIMEOUT_ERROR);
  // The matcher must fail within the budget plus termination grace, keeping
  // this test fast rather than hanging like the synchronous version would.
  expect(Date.now() - startedAt).toBeLessThan(10_000);
});
