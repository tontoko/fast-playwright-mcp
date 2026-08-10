import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  buildUpstreamReport,
  classifyPath,
  githubApiUrl,
  loadUpstreamManifest,
  parseRepositorySlug,
} from '../scripts/upstream-check.js';

test('loads the pinned upstream manifest', async () => {
  const manifest = await loadUpstreamManifest();
  expect(manifest.reviewedCommit).toBe(
    '7e0457a7cbf88823bf0146d12c46ae12c6818247'
  );
  expect(manifest.playwrightReviewedCommit).toBe(
    '8078b85865a9643b37b5564c188a252545253749'
  );
  expect(manifest.playwrightVersion).toBe('1.63.0-alpha-2026-08-05');
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

test('GitHub API URLs keep validated repositories on the fixed origin', () => {
  expect(parseRepositorySlug('microsoft/playwright')).toEqual([
    'microsoft',
    'playwright',
  ]);
  expect(() => parseRepositorySlug('../attacker')).toThrow('valid owner/name');
  expect(() =>
    parseRepositorySlug('microsoft/playwright?access_token=secret')
  ).toThrow('valid owner/name');

  const url = githubApiUrl(
    'microsoft/playwright',
    'compare',
    `${'a'.repeat(40)}...${'b'.repeat(40)}`
  );
  expect(url.origin).toBe('https://api.github.com');
  expect(url.pathname).toBe(
    `/repos/microsoft/playwright/compare/${'a'.repeat(40)}...${'b'.repeat(40)}`
  );
  expect(url.search).toBe('');
});

test('fixture report is stable, dual-source, and read-only', async () => {
  const manifest = await loadUpstreamManifest();
  const fixture = JSON.parse(
    await readFile('tests/upstream/fixtures/compare.json', 'utf8')
  );
  const payloads = { mcp: fixture, playwright: fixture };
  const first = buildUpstreamReport(manifest, payloads);
  const second = buildUpstreamReport(manifest, payloads);
  expect(first).toBe(second);
  expect(first).toContain('## Playwright MCP');
  expect(first).toContain('## Playwright runtime');
  expect(first).toContain(manifest.repository);
  expect(first).toContain(manifest.playwrightRepository);
  expect(first).toContain('This report is read-only');
  expect(first).not.toContain('gh issue');
});
