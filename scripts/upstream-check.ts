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

type ComparePayload = {
  base_commit?: { sha: string };
  commits?: { sha: string; commit?: { message?: string } }[];
  files?: ChangedFile[];
  headSha?: string;
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

export function buildUpstreamReport(
  manifest: UpstreamManifest,
  payload: ComparePayload
): string {
  const head =
    payload.headSha ?? payload.commits?.at(-1)?.sha ?? manifest.reviewedCommit;
  const files = [...(payload.files ?? [])].sort((left, right) => {
    const category = classifyPath(left.filename).localeCompare(
      classifyPath(right.filename)
    );
    return category || left.filename.localeCompare(right.filename);
  });
  const lines = [
    '<!-- upstream-audit -->',
    '# Upstream review',
    '',
    `- Repository: \`${manifest.repository}\``,
    `- Reviewed from: \`${manifest.reviewedCommit}\``,
    `- Compared to: \`${head}\``,
    `- Commits: ${payload.commits?.length ?? 0}`,
    `- Changed files: ${files.length}`,
    '',
    '## Changed files',
    '',
  ];
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
  lines.push(
    '',
    '## Policy',
    '',
    'This report is read-only. Changes are reviewed and ported manually; it never modifies production code or repository issues.',
    ''
  );
  return lines.join('\n');
}

async function githubJson<T>(
  repository: string,
  ...segments: readonly string[]
): Promise<T> {
  const url = githubApiUrl(repository, ...segments);
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {}),
  };
  const response = await fetch(url, { headers }); // NOSONAR
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}): ${url}`);
  }
  return (await response.json()) as T;
}

async function loadPayload(
  manifest: UpstreamManifest,
  fixture?: string
): Promise<ComparePayload> {
  if (fixture) {
    const fixturePath = await resolveWorkspaceInputPath(fixture, {
      extension: '.json',
      label: '--fixture',
    });
    const fixtureText = await readFile(fixturePath, 'utf8'); // NOSONAR
    return JSON.parse(fixtureText) as ComparePayload;
  }
  const latest = await githubJson<{ sha: string }>(
    manifest.repository,
    'commits',
    'main'
  );
  if (!FULL_SHA.test(latest.sha)) {
    throw new Error('GitHub returned an invalid latest commit SHA');
  }
  const compare = await githubJson<ComparePayload>(
    manifest.repository,
    'compare',
    `${manifest.reviewedCommit}...${latest.sha}`
  );
  return { ...compare, headSha: latest.sha };
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      fixture: { type: 'string' },
      output: { type: 'string' },
      manifest: { type: 'string', default: 'upstream.json' },
    },
  });
  const manifest = await loadUpstreamManifest(values.manifest);
  const report = buildUpstreamReport(
    manifest,
    await loadPayload(manifest, values.fixture)
  );
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
