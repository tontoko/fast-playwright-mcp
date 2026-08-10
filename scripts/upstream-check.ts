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

export type UpstreamManifest = {
  repository: string;
  playwrightRepository: string;
  playwrightReviewedCommit: string;
  reviewedCommit: string;
  packageVersion: string;
  playwrightVersion: string;
};

export type ChangedFile = {
  filename: string;
  status: string;
  additions?: number;
  deletions?: number;
  previous_filename?: string;
};

export type GitTreeEntry = {
  path: string;
  mode: string;
  type: 'blob' | 'commit' | 'tree';
  sha: string | null;
  size?: number;
};

export type ComparePayload = {
  ahead_by?: number;
  base_commit?: { sha: string };
  commits?: { sha: string; commit?: { message?: string } }[];
  completeFileList?: boolean;
  files?: ChangedFile[];
  headSha?: string;
  total_commits?: number;
  totalCommits?: number;
};

export type UpstreamReportPayloads = {
  mcp: ComparePayload;
  playwright: ComparePayload;
};

type GitCommitPayload = {
  sha: string;
  tree: { sha: string };
};

type GitTreePayload = {
  sha: string;
  tree: GitTreeEntry[];
  truncated: boolean;
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

function fileEntries(entries: readonly GitTreeEntry[]): Map<string, GitTreeEntry> {
  return new Map(
    entries
      .filter((entry) => entry.type !== 'tree')
      .map((entry) => [entry.path, entry] as const)
  );
}

export function diffTreeEntries(
  baseEntries: readonly GitTreeEntry[],
  headEntries: readonly GitTreeEntry[],
  compareFiles: readonly ChangedFile[] = []
): ChangedFile[] {
  const base = fileEntries(baseEntries);
  const head = fileEntries(headEntries);
  const known = new Map(
    compareFiles.map((file) => [file.filename, file] as const)
  );
  const renamedSources = new Set(
    compareFiles
      .filter((file) => file.status === 'renamed' && file.previous_filename)
      .map((file) => file.previous_filename as string)
  );
  const paths = [...new Set([...base.keys(), ...head.keys()])].sort((left, right) =>
    left.localeCompare(right)
  );
  const result: ChangedFile[] = [];
  const resultPaths = new Set<string>();

  for (const path of paths) {
    const before = base.get(path);
    const after = head.get(path);
    if (
      before &&
      after &&
      before.sha === after.sha &&
      before.mode === after.mode &&
      before.type === after.type
    ) {
      continue;
    }
    if (before && !after && renamedSources.has(path)) {
      continue;
    }
    const status = before ? (after ? 'modified' : 'removed') : 'added';
    const knownFile = known.get(path);
    result.push(knownFile ? { ...knownFile } : { filename: path, status });
    resultPaths.add(path);
  }

  for (const file of compareFiles) {
    if (!resultPaths.has(file.filename)) {
      result.push({ ...file });
    }
  }
  return result.sort((left, right) => left.filename.localeCompare(right.filename));
}

function sortedFiles(payload: ComparePayload): ChangedFile[] {
  return [...(payload.files ?? [])].sort((left, right) => {
    const category = classifyPath(left.filename).localeCompare(
      classifyPath(right.filename)
    );
    return category || left.filename.localeCompare(right.filename);
  });
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
  const totalCommits =
    payload.totalCommits ??
    payload.total_commits ??
    payload.ahead_by ??
    payload.commits?.length ??
    0;
  const lines = [
    `## ${title}`,
    '',
    `- Repository: \`${repository}\``,
    `- Reviewed from: \`${reviewedCommit}\``,
    `- Compared to: \`${head}\``,
    `- Commits: ${totalCommits}`,
    `- Changed files: ${files.length}`,
    `- File inventory: ${
      payload.completeFileList
        ? 'complete recursive tree diff'
        : 'API response or fixture'
    }`,
    '',
    '### Changed files',
    '',
  ];
  if (!files.length) {
    lines.push('No changes found.');
  }
  for (const file of files) {
    const category = classifyPath(file.filename);
    const additions = file.additions ?? '?';
    const deletions = file.deletions ?? '?';
    lines.push(
      `- \`${file.filename}\` — ${file.status}; +${additions}/-${deletions}; category: \`${category}\`; suggested: \`${suggestion(category)}\``
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

function githubHeaders(): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
}

async function githubJsonUrl<T>(url: URL): Promise<T> {
  if (url.origin !== GITHUB_API_ORIGIN) {
    throw new Error('GitHub API URL must use the configured origin');
  }
  const response = await fetch(url, { headers: githubHeaders() }); // NOSONAR
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}): ${url}`);
  }
  return (await response.json()) as T;
}

async function githubJson<T>(
  repository: string,
  ...segments: readonly string[]
): Promise<T> {
  return githubJsonUrl<T>(githubApiUrl(repository, ...segments));
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

async function fetchTreeEntries(
  repository: string,
  commitSha: string
): Promise<GitTreeEntry[]> {
  const commit = await githubJson<GitCommitPayload>(
    repository,
    'git',
    'commits',
    commitSha
  );
  if (!FULL_SHA.test(commit.tree.sha)) {
    throw new Error(`GitHub returned an invalid tree SHA for ${commitSha}`);
  }
  const treeUrl = githubApiUrl(
    repository,
    'git',
    'trees',
    commit.tree.sha
  );
  treeUrl.searchParams.set('recursive', '1');
  const tree = await githubJsonUrl<GitTreePayload>(treeUrl);
  if (tree.truncated) {
    throw new Error(
      `Recursive tree response was truncated for ${repository}@${commitSha}`
    );
  }
  return tree.tree;
}

async function loadComparison(
  repository: string,
  reviewedCommit: string,
  fixture: string | undefined,
  fixtureLabel: string
): Promise<ComparePayload> {
  if (fixture) {
    return readFixture(fixture, fixtureLabel);
  }
  const latest = await githubJson<{ sha: string }>(
    repository,
    'commits',
    'main'
  );
  if (!FULL_SHA.test(latest.sha)) {
    throw new Error('GitHub returned an invalid latest commit SHA');
  }
  const compare = await githubJson<ComparePayload>(
    repository,
    'compare',
    `${reviewedCommit}...${latest.sha}`
  );
  const baseCommit = compare.base_commit?.sha ?? reviewedCommit;
  if (!FULL_SHA.test(baseCommit)) {
    throw new Error('GitHub returned an invalid comparison base SHA');
  }
  const [baseTree, headTree] = await Promise.all([
    fetchTreeEntries(repository, baseCommit),
    fetchTreeEntries(repository, latest.sha),
  ]);
  return {
    ...compare,
    completeFileList: true,
    files: diffTreeEntries(baseTree, headTree, compare.files),
    headSha: latest.sha,
    totalCommits:
      compare.total_commits ??
      compare.ahead_by ??
      compare.commits?.length ??
      0,
  };
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
