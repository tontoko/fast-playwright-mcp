import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import {
  resolveWorkspaceInputPath,
  resolveWorkspaceOutputPath,
} from './path-policy.js';

const FULL_SHA = /^[0-9a-f]{40}$/u;
const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/u;
const REPOSITORY_NAME_PATTERN = /^[A-Za-z0-9._-]{1,100}$/u;
const RESERVED_REPOSITORY_NAMES = new Set(['.', '..']);
const GITHUB_API_ORIGIN = 'https://api.github.com';
const SECURITY_PATH = /(host|origin|secret|sandbox|cdp|network|fileaccess)/u;
const FORMATTING_PREFIXES = ['eslint', 'prettier', 'biome'] as const;
const FORMATTING_MARKERS = ['lint', 'format'] as const;
const AUTOMATION_PATH = /release|publish|roll\.js/u;
const DEPENDENCY_PATH = /package\.json|lock|npmrc/u;
const EXTENSION_PATH = /extension/u;
const CONFIG_PATH = /config|program|cli/u;
const TEST_PATH = /test|spec|fixture/u;
const DOC_PATH = /readme|docs\//u;
const MCP_PATH = /tools|mcp|browser|backend/u;
// The compare endpoint caps the commits array at one page and the files
// array at 300 entries without any pagination hints, so the audit has to
// page commits explicitly and rebuild the file list from per-commit
// windows. GitHub also silently drops files from larger compares even
// below the 300-file cap (verified against a git diff of the same range),
// so windows cover exactly one commit each; only a single commit's own
// diff is reliably complete.
const COMPARE_COMMITS_PER_PAGE = 100;
const COMPARE_FILES_LIMIT = 300;
const COMPARE_WINDOW_SPAN = 1;
const MAX_COMPARE_PAGES = 50;
const MAX_FILE_WINDOWS = 2000;

export type UpstreamManifest = {
  repository: string;
  playwrightRepository: string;
  playwrightReviewedCommit: string;
  reviewedCommit: string;
  packageVersion: string;
  playwrightVersion: string;
};

type ChangedFile = {
  filename: string;
  status: string;
  additions?: number;
  deletions?: number;
};

export type CompareCommit = { sha: string; commit?: { message?: string } };

export type CompareWindow = {
  /** Oldest boundary commit; the window contains commits strictly after it. */
  base: string;
  /** Newest boundary commit; the window contains commits up to and including it. */
  head: string;
};

export type ComparePayload = {
  base_commit?: { sha: string };
  commits?: CompareCommit[];
  files?: ChangedFile[];
  headSha?: string;
  ahead_by?: number;
  total_commits?: number;
  truncated?: boolean;
};

export type UpstreamReportPayloads = {
  mcp: ComparePayload;
  playwright: ComparePayload;
};

export function parseRepositorySlug(
  value: string,
  label = 'repository'
): readonly [string, string] {
  const [owner, name, extra] = value.split('/');
  if (
    extra !== undefined ||
    !owner ||
    !name ||
    !OWNER_PATTERN.test(owner) ||
    !REPOSITORY_NAME_PATTERN.test(name) ||
    RESERVED_REPOSITORY_NAMES.has(name)
  ) {
    throw new Error(`${label} must use a valid owner/name GitHub slug`);
  }
  return [owner, name];
}

export function githubApiUrl(
  repository: string,
  ...segments: readonly string[]
): URL {
  const [owner, name] = parseRepositorySlug(repository);
  const encodedPath = ['repos', owner, name, ...segments]
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  const url = new URL(`/${encodedPath}`, GITHUB_API_ORIGIN);
  if (url.origin !== GITHUB_API_ORIGIN) {
    throw new Error('GitHub API URL must use the configured origin');
  }
  return url;
}

function validateManifest(manifest: UpstreamManifest): void {
  if (!FULL_SHA.test(manifest.reviewedCommit)) {
    throw new Error('reviewedCommit must be a full 40-character SHA');
  }
  if (!FULL_SHA.test(manifest.playwrightReviewedCommit)) {
    throw new Error('playwrightReviewedCommit must be a full 40-character SHA');
  }
  parseRepositorySlug(manifest.repository, 'repository');
  parseRepositorySlug(manifest.playwrightRepository, 'playwrightRepository');
}

export async function loadUpstreamManifest(
  path = 'upstream.json'
): Promise<UpstreamManifest> {
  const manifestPath = await resolveWorkspaceInputPath(path, {
    extension: '.json',
    label: '--manifest',
  });
  const manifestText = await readFile(manifestPath, 'utf8'); // NOSONAR
  const manifest = JSON.parse(manifestText) as UpstreamManifest;
  validateManifest(manifest);
  return manifest;
}

export type UpstreamCategory =
  | 'security'
  | 'mcp-behavior'
  | 'configuration'
  | 'extension'
  | 'dependencies'
  | 'tests'
  | 'documentation'
  | 'excluded-formatting'
  | 'excluded-automation'
  | 'other';

function isFormattingPath(path: string): boolean {
  return (
    FORMATTING_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
    FORMATTING_MARKERS.some((marker) => path.includes(marker))
  );
}

export function classifyPath(path: string): UpstreamCategory {
  const lower = path.toLowerCase();
  if (SECURITY_PATH.test(lower)) {
    return 'security';
  }
  if (isFormattingPath(lower)) {
    return 'excluded-formatting';
  }
  if (lower.startsWith('.github/') || AUTOMATION_PATH.test(lower)) {
    return 'excluded-automation';
  }
  if (DEPENDENCY_PATH.test(lower)) {
    return 'dependencies';
  }
  if (EXTENSION_PATH.test(lower)) {
    return 'extension';
  }
  if (CONFIG_PATH.test(lower)) {
    return 'configuration';
  }
  if (TEST_PATH.test(lower)) {
    return 'tests';
  }
  if (DOC_PATH.test(lower)) {
    return 'documentation';
  }
  if (MCP_PATH.test(lower)) {
    return 'mcp-behavior';
  }
  return 'other';
}

function suggestion(category: UpstreamCategory): string {
  if (
    category === 'security' ||
    category === 'mcp-behavior' ||
    category === 'configuration' ||
    category === 'extension'
  ) {
    return 'port';
  }
  if (category.startsWith('excluded-')) {
    return 'reject';
  }
  if (category === 'tests' || category === 'documentation') {
    return 'defer';
  }
  return 'review';
}

function isReportPayloads(
  payload: ComparePayload | UpstreamReportPayloads
): payload is UpstreamReportPayloads {
  return 'mcp' in payload && 'playwright' in payload;
}

function sortedFiles(payload: ComparePayload): ChangedFile[] {
  return [...(payload.files ?? [])].sort((left, right) => {
    const category = classifyPath(left.filename).localeCompare(
      classifyPath(right.filename)
    );
    return category || left.filename.localeCompare(right.filename);
  });
}

export function compareCommitCount(payload: ComparePayload): number {
  return (
    payload.ahead_by ?? payload.total_commits ?? payload.commits?.length ?? 0
  );
}

export function mergeCompareFiles(
  windows: readonly (readonly ChangedFile[])[]
): ChangedFile[] {
  const merged = new Map<string, ChangedFile>();
  for (const window of windows) {
    for (const file of window) {
      const existing = merged.get(file.filename);
      if (!existing) {
        merged.set(file.filename, file);
        continue;
      }
      merged.set(file.filename, {
        ...existing,
        status: file.status,
        additions: (existing.additions ?? 0) + (file.additions ?? 0),
        deletions: (existing.deletions ?? 0) + (file.deletions ?? 0),
      });
    }
  }
  return [...merged.values()];
}

function renderComparison(
  title: string,
  repository: string,
  reviewedCommit: string,
  payload: ComparePayload
): string[] {
  const head =
    payload.headSha ?? payload.commits?.at(-1)?.sha ?? reviewedCommit;
  const files = sortedFiles(payload);
  const lines = [
    `## ${title}`,
    '',
    `- Repository: \`${repository}\``,
    `- Reviewed from: \`${reviewedCommit}\``,
    `- Compared to: \`${head}\``,
    `- Commits: ${compareCommitCount(payload)}`,
    `- Changed files: ${files.length}`,
    '',
  ];
  if (payload.truncated) {
    lines.push(
      '⚠️ The GitHub comparison was truncated by API limits, so the commit count and file list may understate upstream changes.',
      ''
    );
  }
  lines.push('### Changed files', '');
  if (!files.length) {
    lines.push('No changes found.');
  }
  for (const file of files) {
    const category = classifyPath(file.filename);
    lines.push(
      `- \`${file.filename}\` — ${file.status}; +${file.additions ?? 0}/-${
        file.deletions ?? 0
      }; category: \`${category}\`; suggested: \`${suggestion(category)}\``
    );
  }
  lines.push('');
  return lines;
}

export function buildUpstreamReport(
  manifest: UpstreamManifest,
  payload: ComparePayload | UpstreamReportPayloads
): string {
  const payloads = isReportPayloads(payload)
    ? payload
    : {
        mcp: payload,
        playwright: { headSha: manifest.playwrightReviewedCommit },
      };
  return [
    '<!-- upstream-audit -->',
    '# Upstream review',
    '',
    ...renderComparison(
      'Playwright MCP',
      manifest.repository,
      manifest.reviewedCommit,
      payloads.mcp
    ),
    ...renderComparison(
      'Playwright runtime',
      manifest.playwrightRepository,
      manifest.playwrightReviewedCommit,
      payloads.playwright
    ),
    '## Policy',
    '',
    'This report is read-only. Changes are reviewed and ported manually; it never modifies production code or repository issues.',
    '',
  ].join('\n');
}

const RETRY_AFTER_CAP_SECONDS = 60;

function retryDelayMilliseconds(response: Response): number | undefined {
  const retryAfter = Number(response.headers.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(retryAfter, RETRY_AFTER_CAP_SECONDS) * 1000;
  }
  return 5000;
}

async function githubJsonUrl<T>(url: URL): Promise<T> {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
  let response = await fetch(url, { headers }); // NOSONAR
  // The per-commit audit requests can trip rate limits; wait once and retry
  // rather than failing the whole report.
  if (response.status === 429 || response.status === 403) {
    const delay = retryDelayMilliseconds(response);
    await new Promise((resolve) => setTimeout(resolve, delay));
    response = await fetch(url, { headers }); // NOSONAR
  }
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}): ${url}`);
  }
  return (await response.json()) as T;
}

function githubJson<T>(
  repository: string,
  ...segments: readonly string[]
): Promise<T> {
  return githubJsonUrl<T>(githubApiUrl(repository, ...segments));
}

function githubComparePage(
  repository: string,
  basehead: string,
  page: number
): Promise<ComparePayload> {
  const url = githubApiUrl(repository, 'compare', basehead);
  url.searchParams.set('per_page', String(COMPARE_COMMITS_PER_PAGE));
  url.searchParams.set('page', String(page));
  return githubJsonUrl<ComparePayload>(url);
}

export function planCompareWindows(
  reviewedCommit: string,
  aheadShasOldestFirst: readonly string[],
  span: number
): CompareWindow[] {
  if (span < 1) {
    throw new Error('Compare window span must be positive');
  }
  const boundaryIndices: number[] = [];
  for (let index = 0; index < aheadShasOldestFirst.length; index += span) {
    boundaryIndices.push(index);
  }
  if (boundaryIndices.at(-1) !== aheadShasOldestFirst.length) {
    boundaryIndices.push(aheadShasOldestFirst.length);
  }
  const boundaryCommit = (index: number) =>
    index === 0 ? reviewedCommit : aheadShasOldestFirst[index - 1];
  const windows: CompareWindow[] = [];
  for (let position = 0; position < boundaryIndices.length - 1; position++) {
    windows.push({
      base: boundaryCommit(boundaryIndices[position]),
      head: boundaryCommit(boundaryIndices[position + 1]),
    });
  }
  return windows;
}

export function buildFileWindows(
  commits: readonly CompareCommit[],
  reviewedCommit: string,
  headSha: string,
  span = COMPARE_WINDOW_SPAN,
  maxWindows = MAX_FILE_WINDOWS
): { windows: CompareWindow[]; truncated: boolean } {
  const aheadShasOldestFirst = commits
    .map((commit) => commit.sha)
    .filter((sha) => sha !== reviewedCommit);
  // The walk should end at the head commit; if it does not, the commit list
  // is incomplete and no window may be synthesized for the uncovered tail —
  // a large window is exactly what silently drops files.
  const reachedHead = aheadShasOldestFirst.length
    ? aheadShasOldestFirst.at(-1) === headSha
    : headSha === reviewedCommit;
  const windows = planCompareWindows(
    reviewedCommit,
    aheadShasOldestFirst,
    span
  );
  // When the window budget is exceeded, keep the newest windows (the most
  // relevant for port review) and let the truncation flag carry the rest.
  const bounded =
    windows.length > maxWindows
      ? windows.slice(windows.length - maxWindows)
      : windows;
  return {
    windows: bounded,
    truncated: !reachedHead || bounded.length < windows.length,
  };
}

async function fetchWindowFiles(
  repository: string,
  window: CompareWindow
): Promise<{ files: ChangedFile[]; truncated: boolean }> {
  const payload = await githubComparePage(
    repository,
    `${window.base}...${window.head}`,
    1
  );
  const files = payload.files ?? [];
  return { files, truncated: files.length >= COMPARE_FILES_LIMIT };
}

async function loadNetworkComparison(
  repository: string,
  reviewedCommit: string
): Promise<ComparePayload> {
  const latest = await githubJson<{ sha: string }>(
    repository,
    'commits',
    'main'
  );
  if (!FULL_SHA.test(latest.sha)) {
    throw new Error('GitHub returned an invalid latest commit SHA');
  }
  const basehead = `${reviewedCommit}...${latest.sha}`;
  const first = await githubComparePage(repository, basehead, 1);
  const expected = compareCommitCount(first);
  const commitsBySha = new Map<string, CompareCommit>();
  for (const commit of first.commits ?? []) {
    commitsBySha.set(commit.sha, commit);
  }
  for (
    let page = 2;
    commitsBySha.size < expected && page <= MAX_COMPARE_PAGES;
    page++
  ) {
    // biome-ignore lint/nursery/noAwaitInLoop: compare pages are fetched sequentially to stay within GitHub rate limits.
    const next = await githubComparePage(repository, basehead, page);
    const fresh = next.commits ?? [];
    if (!fresh.length) {
      break;
    }
    const sizeBefore = commitsBySha.size;
    for (const commit of fresh) {
      commitsBySha.set(commit.sha, commit);
    }
    // A repeated or ignored page would otherwise burn the remaining budget.
    if (commitsBySha.size === sizeBefore) {
      break;
    }
  }
  const commits = [...commitsBySha.values()];
  // behind_by > 0 means the reviewed commit is no longer an ancestor of main
  // (e.g. an upstream force push), so the three-dot comparison is unreliable.
  let truncated = commits.length < expected || (first.behind_by ?? 0) > 0;

  // Rebuild the file list from per-commit windows: the compare files array
  // is capped at 300 entries and can silently omit files even below that
  // cap, while a single commit's own diff is complete up to the cap.
  const { windows, truncated: windowsTruncated } = buildFileWindows(
    commits,
    reviewedCommit,
    latest.sha
  );
  truncated ||= windowsTruncated;
  const collected: ChangedFile[][] = [];
  for (const window of windows) {
    // biome-ignore lint/nursery/noAwaitInLoop: per-commit windows are fetched sequentially to stay within GitHub rate limits.
    const result = await fetchWindowFiles(repository, window);
    collected.push(result.files);
    truncated ||= result.truncated;
  }
  const files = mergeCompareFiles(collected);

  return {
    base_commit: first.base_commit,
    commits,
    files,
    headSha: latest.sha,
    ahead_by: first.ahead_by,
    total_commits: first.total_commits,
    truncated,
  };
}

async function readFixture(
  path: string,
  label: string
): Promise<ComparePayload> {
  const fixturePath = await resolveWorkspaceInputPath(path, {
    extension: '.json',
    label,
  });
  const fixtureText = await readFile(fixturePath, 'utf8'); // NOSONAR
  return JSON.parse(fixtureText) as ComparePayload;
}

function loadComparison(
  repository: string,
  reviewedCommit: string,
  fixture: string | undefined,
  fixtureLabel: string
): Promise<ComparePayload> {
  if (fixture) {
    return readFixture(fixture, fixtureLabel);
  }
  return loadNetworkComparison(repository, reviewedCommit);
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      fixture: { type: 'string' },
      'playwright-fixture': { type: 'string' },
      output: { type: 'string' },
      manifest: { type: 'string', default: 'upstream.json' },
    },
  });
  const manifest = await loadUpstreamManifest(values.manifest);
  const playwrightFixture = values['playwright-fixture'] ?? values.fixture;
  const [mcp, playwright] = await Promise.all([
    loadComparison(
      manifest.repository,
      manifest.reviewedCommit,
      values.fixture,
      '--fixture'
    ),
    loadComparison(
      manifest.playwrightRepository,
      manifest.playwrightReviewedCommit,
      playwrightFixture,
      '--playwright-fixture'
    ),
  ]);
  const report = buildUpstreamReport(manifest, { mcp, playwright });
  if (values.output) {
    const outputPath = await resolveWorkspaceOutputPath(values.output, {
      label: '--output',
    });
    await writeFile(outputPath, report, 'utf8'); // NOSONAR
  } else {
    process.stdout.write(`${report}\n`);
  }
  process.exit(0);
}
