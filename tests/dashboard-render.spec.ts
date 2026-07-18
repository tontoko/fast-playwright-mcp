import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { parseTabLines } from '../src/apps/dashboard/render.js';

const HTML_SINK_PATTERN = /innerHTML|outerHTML|insertAdjacentHTML/u;

test('tab parser preserves untrusted labels as plain data', () => {
  const entries = parseTabLines(
    '- 0: [<img src=x onerror=alert(1)>] (https://example.test/?q=<script>)'
  );
  expect(entries).toEqual([
    {
      index: 0,
      label:
        '[<img src=x onerror=alert(1)>] (https://example.test/?q=<script>)',
    },
  ]);
});

test('tab parser rejects malformed and unsafe indexes without backtracking', () => {
  const oversizedIndex = '9'.repeat(100_000);
  expect(
    parseTabLines(
      `not a tab\n- x: invalid\n- 1: valid\n- ${oversizedIndex}: oversized`
    )
  ).toEqual([{ index: 1, label: 'valid' }]);
});

test('dashboard renderer does not use HTML string sinks', async () => {
  const source = await readFile('src/apps/dashboard/render.ts', 'utf8');
  expect(source).not.toMatch(HTML_SINK_PATTERN);
  expect(source).toContain('textContent');
});
