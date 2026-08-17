import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import {
  buildFileWindows,
  buildUpstreamReport,
  type CompareCommit,
  type ComparePayload,
  classifyPath,
  compareCommitCount,
  githubApiUrl,
  loadUpstreamManifest,
  mergeCompareFiles,
  parseRepositorySlug,
  planCompareWindows,
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

const paddedSha = (value: number) => `${value}`.padStart(40, '0');

test('commit counts prefer the compare totals over capped commit arrays', () => {
  expect(
    compareCommitCount({
      commits: Array.from({ length: 250 }, (_, i) => ({
        sha: paddedSha(i),
      })),
      ahead_by: 610,
      total_commits: 610,
    })
  ).toBe(610);
  expect(
    compareCommitCount({
      commits: Array.from({ length: 250 }, (_, i) => ({
        sha: paddedSha(i),
      })),
    })
  ).toBe(250);
  expect(compareCommitCount({})).toBe(0);
});

test('window files merge across commit windows with aggregated churn', () => {
  expect(
    mergeCompareFiles([
      [
        {
          filename: 'src/a.ts',
          status: 'modified',
          additions: 1,
          deletions: 2,
        },
      ],
      [
        {
          filename: 'src/a.ts',
          status: 'modified',
          additions: 3,
          deletions: 4,
        },
        { filename: 'src/b.ts', status: 'added' },
      ],
    ])
  ).toEqual([
    { filename: 'src/a.ts', status: 'modified', additions: 4, deletions: 6 },
    { filename: 'src/b.ts', status: 'added' },
  ]);
});

test('compare windows cover every commit exactly once', () => {
  const reviewed = paddedSha(0);
  const shas = [1, 2, 3, 4, 5].map((value) => paddedSha(value));
  expect(planCompareWindows(reviewed, shas, 2)).toEqual([
    { base: reviewed, head: paddedSha(2) },
    { base: paddedSha(2), head: paddedSha(4) },
    { base: paddedSha(4), head: paddedSha(5) },
  ]);
  expect(planCompareWindows(reviewed, shas.slice(0, 1), 100)).toEqual([
    { base: reviewed, head: paddedSha(1) },
  ]);
  expect(planCompareWindows(reviewed, [], 100)).toEqual([]);
  expect(() => planCompareWindows(reviewed, shas, 0)).toThrow(
    'Compare window span must be positive'
  );
});

const commitsOf = (shas: number[]): CompareCommit[] =>
  shas.map((value) => ({ sha: paddedSha(value) }));

test('file windows stay per-commit and flag incomplete commit walks', () => {
  const reviewed = paddedSha(0);
  const head = paddedSha(5);

  const complete = buildFileWindows(commitsOf([1, 2, 3, 4, 5]), reviewed, head);
  expect(complete.truncated).toBe(false);
  expect(complete.windows).toEqual([
    { base: reviewed, head: paddedSha(1) },
    { base: paddedSha(1), head: paddedSha(2) },
    { base: paddedSha(2), head: paddedSha(3) },
    { base: paddedSha(3), head: paddedSha(4) },
    { base: paddedSha(4), head: paddedSha(5) },
  ]);

  // The walk stopped before the head commit: cover only the walked commits
  // and never synthesize a large window for the uncovered tail.
  const stalled = buildFileWindows(commitsOf([1, 2, 3]), reviewed, head);
  expect(stalled.truncated).toBe(true);
  expect(stalled.windows.at(-1)).toEqual({
    base: paddedSha(2),
    head: paddedSha(3),
  });

  const identical = buildFileWindows([], reviewed, reviewed);
  expect(identical).toEqual({ windows: [], truncated: false });

  const diverged = buildFileWindows([], reviewed, head);
  expect(diverged).toEqual({ windows: [], truncated: true });
});

test('file window budget keeps the newest windows', () => {
  const reviewed = paddedSha(0);
  const result = buildFileWindows(
    commitsOf([1, 2, 3, 4, 5]),
    reviewed,
    paddedSha(5),
    1,
    3
  );
  expect(result.truncated).toBe(true);
  expect(result.windows).toEqual([
    { base: paddedSha(2), head: paddedSha(3) },
    { base: paddedSha(3), head: paddedSha(4) },
    { base: paddedSha(4), head: paddedSha(5) },
  ]);
});

test('report surfaces truncated comparisons and full commit totals', async () => {
  const manifest = await loadUpstreamManifest();
  const payload: ComparePayload = {
    commits: [{ sha: paddedSha(1) }],
    files: [{ filename: 'src/a.ts', status: 'modified' }],
    ahead_by: 610,
    truncated: true,
  };
  const truncatedReport = buildUpstreamReport(manifest, payload);
  expect(truncatedReport).toContain('Commits: 610');
  expect(truncatedReport).toContain('truncated by API limits');

  const completeReport = buildUpstreamReport(manifest, {
    ...payload,
    truncated: false,
  });
  expect(completeReport).toContain('Commits: 610');
  expect(completeReport).not.toContain('truncated by API limits');
});
