import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  buildUpstreamReport,
  loadUpstreamManifest,
} from '../scripts/upstream-check.js';

test('upstream report contains independent MCP and Playwright comparisons', async () => {
  const manifest = await loadUpstreamManifest();
  const fixture = JSON.parse(
    await readFile('tests/upstream/fixtures/compare.json', 'utf8')
  );
  const report = buildUpstreamReport(
    manifest,
    {
      mcp: fixture,
      playwright: {
        ...fixture,
        headSha: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      },
    } as never
  );

  expect(report).toContain('## Playwright MCP');
  expect(report).toContain(`Repository: \`${manifest.repository}\``);
  expect(report).toContain('## Playwright runtime');
  expect(report).toContain(`Repository: \`${manifest.playwrightRepository}\``);
  expect(report).toContain(
    `Reviewed from: \`${manifest.playwrightReviewedCommit}\``
  );
  expect(report).toContain(
    'Compared to: `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`'
  );
});
