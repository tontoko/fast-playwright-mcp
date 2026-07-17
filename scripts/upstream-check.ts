import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const FULL_SHA = /^[0-9a-f]{40}$/u;
const SECURITY_PATH = /(host|origin|secret|sandbox|cdp|network|fileaccess)/u;
const FORMATTING_PATH = /^(eslint|prettier|biome)|lint|format/u;
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

export async function loadUpstreamManifest(
  path = 'upstream.json'
): Promise<UpstreamManifest> {
  const manifest = JSON.parse(await readFile(path, 'utf8')) as UpstreamManifest;
  if (!FULL_SHA.test(manifest.reviewedCommit)) {
    throw new Error('reviewedCommit must be a full 40-character SHA');
  }
  if (
    !(
      manifest.repository.includes('/') &&
      manifest.playwrightRepository.includes('/')
    )
  ) {
    throw new Error('upstream repositories must use owner/name format');
  }
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

export function classifyPath(path: string): UpstreamCategory {
  const lower = path.toLowerCase();
  if (SECURITY_PATH.test(lower)) {
    return 'security';
  }
  if (FORMATTING_PATH.test(lower)) {
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

async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {}),
    },
  });
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
    return JSON.parse(await readFile(fixture, 'utf8')) as ComparePayload;
  }
  const latest = await githubJson<{ sha: string }>(
    `https://api.github.com/repos/${manifest.repository}/commits/main`
  );
  const compare = await githubJson<ComparePayload>(
    `https://api.github.com/repos/${manifest.repository}/compare/${manifest.reviewedCommit}...${latest.sha}`
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
    await writeFile(values.output, report, 'utf8');
  } else {
    process.stdout.write(`${report}\n`);
  }
  process.exit(0);
}
