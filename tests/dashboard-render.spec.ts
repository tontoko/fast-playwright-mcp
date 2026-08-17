import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  firstText,
  isErrorResult,
  parseTabLines,
} from '../src/apps/dashboard/render.js';

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

test('tool error results are detected while successes stay silent', () => {
  expect(isErrorResult({ isError: true, content: [] })).toBe(true);
  expect(
    isErrorResult({
      isError: true,
      content: [{ type: 'text', text: 'No open pages available.' }],
    })
  ).toBe(true);
  // A successful response without an image part (imageResponses: 'omit')
  // must not be treated as an error.
  expect(isErrorResult({ content: [] })).toBe(false);
  expect(isErrorResult({ isError: false, content: [] })).toBe(false);
  expect(isErrorResult(undefined)).toBe(false);
  expect(isErrorResult('text')).toBe(false);

  expect(firstText([{ type: 'text', text: 'No open pages available.' }])).toBe(
    'No open pages available.'
  );
  expect(
    firstText([{ type: 'image', data: 'aGk=', mimeType: 'image/png' }])
  ).toBeUndefined();
});
