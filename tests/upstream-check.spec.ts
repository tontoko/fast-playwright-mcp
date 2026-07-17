import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  buildUpstreamReport,
  classifyPath,
  loadUpstreamManifest,
} from '../scripts/upstream-check.js';

test('loads the pinned upstream manifest', async () => {
  const manifest = await loadUpstreamManifest();
  expect(manifest.reviewedCommit).toBe(
    '5f8fc00210b27b4407c375b59cda4838045d429c'
  );
  expect(manifest.playwrightVersion).toBe('1.62.0-alpha-1783623505000');
});

test('classifies upstream paths deterministically', () => {
  expect(
    classifyPath('packages/playwright-core/src/tools/backend/find.ts')
  ).toBe('mcp-behavior');
  expect(classifyPath('packages/playwright-core/src/tools/mcp/config.ts')).toBe(
    'configuration'
  );
  expect(classifyPath('.github/workflows/release.yml')).toBe(
    'excluded-automation'
  );
  expect(classifyPath('README.md')).toBe('documentation');
});

test('fixture report is stable and read-only', async () => {
  const manifest = await loadUpstreamManifest();
  const fixture = JSON.parse(
    await readFile('tests/upstream/fixtures/compare.json', 'utf8')
  );
  const first = buildUpstreamReport(manifest, fixture);
  const second = buildUpstreamReport(manifest, fixture);
  expect(first).toBe(second);
  expect(first).toContain('This report is read-only');
  expect(first).not.toContain('gh issue');
});
