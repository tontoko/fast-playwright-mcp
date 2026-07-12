# Upstream Compatibility Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a repeatable, evidence-based process for reviewing Microsoft Playwright MCP changes without importing upstream linting, formatting, release automation, or unrelated churn.

**Architecture:** Store the last reviewed upstream point in `upstream.json`, generate a deterministic comparison report with a Bun script, and run that report weekly in a read-only code workflow that creates or updates one GitHub issue. Production changes are always ported manually in separate pull requests with source attribution and conformance tests.

**Tech Stack:** TypeScript, Bun, Node `fetch`, GitHub REST API, GitHub CLI, Playwright Test, pinned GitHub Actions.

## Global Constraints

- Upstream repository: `microsoft/playwright-mcp`.
- Upstream Playwright repository: `microsoft/playwright`.
- Initial reviewed MCP commit: `5f8fc00210b27b4407c375b59cda4838045d429c`.
- Initial upstream package version: `0.0.78`.
- Initial upstream Playwright version: `1.62.0-alpha-1783623505000`.
- The workflow may create or edit one tracking issue, but may not modify production code or open automatic merge pull requests.
- Never import upstream formatter/linter config, generated README output, release automation, unrelated dependency bumps, or behavior that weakens local features.
- Every behavioral port records repository, full commit SHA, and source path and adds a local conformance test.
- All GitHub Actions references use full 40-character commit SHAs.
- Keep the existing Ultracite/Biome toolchain.

---

## File Structure

**Create**

- `upstream.json` — reviewed upstream state.
- `scripts/upstream/types.ts` — manifest, compare, classification, and report types.
- `scripts/upstream/github.ts` — authenticated GitHub REST reads.
- `scripts/upstream/classify.ts` — deterministic path and commit classification.
- `scripts/upstream/report.ts` — Markdown report generation.
- `scripts/upstream-check.ts` — CLI entry point.
- `tests/upstream/fixtures/compare.json` — stable comparison fixture.
- `tests/upstream/fixtures/commits.json` — stable commit fixture.
- `tests/upstream-check.spec.ts` — manifest, classification, and output tests.
- `docs/upstream-policy.md` — porting rules and review checklist.
- `docs/upstream-compatibility.md` — current reviewed point and port matrix.
- `.github/workflows/upstream-audit.yml` — weekly issue updater.

**Modify**

- `package.json` — add `upstream:check` and `upstream:check:fixture`.
- `src/tools/catalog/registry.ts` — validate optional upstream metadata from the adaptive-catalog plan.
- `tests/tool-registry.spec.ts` — validate attribution metadata.
- `README.md` — link the compatibility policy.

---

### Task 1: Add the upstream manifest and typed GitHub reader

**Files:**
- Create: `upstream.json`
- Create: `scripts/upstream/types.ts`
- Create: `scripts/upstream/github.ts`
- Create: `tests/upstream/fixtures/compare.json`
- Test: `tests/upstream-check.spec.ts`

**Interfaces:**
- Produces: `loadUpstreamManifest(path): Promise<UpstreamManifest>`.
- Produces: `fetchLatestCommit`, `compareCommits`, and `fetchCommitRange`.

- [ ] **Step 1: Write failing manifest tests**

Create `tests/upstream-check.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { loadUpstreamManifest } from '../scripts/upstream/github.js';

test('loads the pinned upstream manifest', async () => {
  const manifest = await loadUpstreamManifest('upstream.json');
  expect(manifest).toEqual({
    repository: 'microsoft/playwright-mcp',
    playwrightRepository: 'microsoft/playwright',
    reviewedCommit: '5f8fc00210b27b4407c375b59cda4838045d429c',
    packageVersion: '0.0.78',
    playwrightVersion: '1.62.0-alpha-1783623505000',
  });
});

test('rejects a non-full reviewed commit', async ({}, testInfo) => {
  const path = testInfo.outputPath('upstream.json');
  await Bun.write(
    path,
    JSON.stringify({
      repository: 'microsoft/playwright-mcp',
      playwrightRepository: 'microsoft/playwright',
      reviewedCommit: 'main',
      packageVersion: '0.0.78',
      playwrightVersion: '1.62.0-alpha-1783623505000',
    })
  );
  await expect(loadUpstreamManifest(path)).rejects.toThrow(
    'reviewedCommit must be a full 40-character SHA'
  );
});
```

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/upstream-check.spec.ts --project=chromium
```

Expected: missing-module failure.

- [ ] **Step 3: Create the manifest**

Create `upstream.json`:

```json
{
  "repository": "microsoft/playwright-mcp",
  "playwrightRepository": "microsoft/playwright",
  "reviewedCommit": "5f8fc00210b27b4407c375b59cda4838045d429c",
  "packageVersion": "0.0.78",
  "playwrightVersion": "1.62.0-alpha-1783623505000"
}
```

- [ ] **Step 4: Define types and validation**

Create `scripts/upstream/types.ts`:

```ts
export type UpstreamManifest = {
  repository: string;
  playwrightRepository: string;
  reviewedCommit: string;
  packageVersion: string;
  playwrightVersion: string;
};

export type UpstreamChangedFile = {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  changes: number;
  previous_filename?: string;
};

export type UpstreamCommit = {
  sha: string;
  html_url: string;
  commit: { message: string; author: { date: string } };
};

export type UpstreamCompare = {
  base_commit: { sha: string };
  merge_base_commit: { sha: string };
  commits: UpstreamCommit[];
  files: UpstreamChangedFile[];
};
```

- [ ] **Step 5: Implement authenticated reads**

Create `scripts/upstream/github.ts` with:

```ts
const SHA_PATTERN = /^[0-9a-f]{40}$/u;

export async function loadUpstreamManifest(
  path: string
): Promise<UpstreamManifest> {
  const manifest = JSON.parse(await Bun.file(path).text()) as UpstreamManifest;
  if (!SHA_PATTERN.test(manifest.reviewedCommit)) {
    throw new Error('reviewedCommit must be a full 40-character SHA');
  }
  return manifest;
}

async function githubJson<T>(url: string, token?: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}): ${url}`);
  }
  return (await response.json()) as T;
}

export function compareCommits(
  repository: string,
  base: string,
  head: string,
  token = process.env.GITHUB_TOKEN
): Promise<UpstreamCompare> {
  return githubJson(
    `https://api.github.com/repos/${repository}/compare/${base}...${head}`,
    token
  );
}
```

Implement `fetchLatestCommit(repository, branch = 'main')` from `/commits/<branch>` and validate the returned SHA.

- [ ] **Step 6: Add a stable comparison fixture**

Create a compact `tests/upstream/fixtures/compare.json` with at least:

- one MCP backend tool change;
- one config change;
- one test change;
- one README-only change;
- one workflow or release-only change.

Every fixture SHA must be a 40-character lowercase hexadecimal string.

- [ ] **Step 7: Verify GREEN**

```bash
bunx playwright test tests/upstream-check.spec.ts --project=chromium
```

Expected: PASS without network access.

- [ ] **Step 8: Commit**

```bash
git add upstream.json scripts/upstream/types.ts scripts/upstream/github.ts tests/upstream/fixtures/compare.json tests/upstream-check.spec.ts
git commit -m "chore: record reviewed upstream state"
```

---

### Task 2: Classify changes and generate a deterministic report

**Files:**
- Create: `scripts/upstream/classify.ts`
- Create: `scripts/upstream/report.ts`
- Create: `scripts/upstream-check.ts`
- Create: `tests/upstream/fixtures/commits.json`
- Modify: `tests/upstream-check.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `classifyPath(path): UpstreamCategory`.
- Produces: `buildUpstreamReport(input): string`.
- CLI: `bun run upstream:check -- --from <sha> --to <sha|main> --output <path>`.

- [ ] **Step 1: Write failing classification tests**

Add:

```ts
expect(classifyPath('packages/playwright-core/src/tools/backend/find.ts'))
  .toBe('mcp-behavior');
expect(classifyPath('packages/playwright-core/src/tools/mcp/config.ts'))
  .toBe('configuration');
expect(classifyPath('tests/extension/extension.spec.ts'))
  .toBe('tests');
expect(classifyPath('.github/workflows/release.yml'))
  .toBe('excluded-automation');
expect(classifyPath('README.md')).toBe('documentation');
```

Add a report snapshot assertion that ensures stable sorting by category then path.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/upstream-check.spec.ts --project=chromium
```

Expected: missing exports.

- [ ] **Step 3: Implement path classification**

Create this category union:

```ts
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
```

Use explicit ordered rules. Security-sensitive keywords (`network`, `origin`, `host`, `secret`, `fileAccess`, `cdp`, `extension`, `sandbox`) take precedence over general MCP behavior. Treat lint/format config and release workflows as excluded categories rather than port candidates.

- [ ] **Step 4: Implement report generation**

`buildUpstreamReport` must emit these sections in order:

```markdown
<!-- upstream-audit -->
# Upstream review

- Reviewed from: `<full sha>`
- Compared to: `<full sha>`
- Commits: N
- Changed files: N

## Security-sensitive changes
## MCP behavior candidates
## Configuration candidates
## Extension candidates
## Dependency changes
## Tests and documentation
## Explicitly excluded changes
## Proposed classifications
```

Each changed file line includes status, additions/deletions, category, and a GitHub link. Proposed classification is one of `port`, `already-covered`, `defer`, or `reject`; the script uses deterministic defaults and clearly labels them as suggestions.

- [ ] **Step 5: Implement the CLI**

Use `node:util.parseArgs` with exact options:

```ts
const { values } = parseArgs({
  options: {
    from: { type: 'string' },
    to: { type: 'string', default: 'main' },
    output: { type: 'string' },
    fixture: { type: 'string' },
  },
});
```

When `--fixture` is provided, read fixture JSON and make no network request. Otherwise, load `upstream.json`, resolve the head SHA, compare, and write the report to `--output` or stdout.

- [ ] **Step 6: Add scripts**

Add to `package.json`:

```json
"upstream:check": "bun scripts/upstream-check.ts",
"upstream:check:fixture": "bun scripts/upstream-check.ts --fixture tests/upstream/fixtures/compare.json"
```

- [ ] **Step 7: Verify GREEN and determinism**

```bash
bunx playwright test tests/upstream-check.spec.ts --project=chromium
bun run upstream:check:fixture > /tmp/report-1.md
bun run upstream:check:fixture > /tmp/report-2.md
diff -u /tmp/report-1.md /tmp/report-2.md
```

Expected: tests pass and `diff` is empty.

- [ ] **Step 8: Commit**

```bash
git add scripts/upstream/classify.ts scripts/upstream/report.ts scripts/upstream-check.ts tests/upstream/fixtures/commits.json tests/upstream-check.spec.ts package.json
git commit -m "feat: generate upstream compatibility reports"
```

---

### Task 3: Create the weekly tracking-issue workflow

**Files:**
- Create: `.github/workflows/upstream-audit.yml`
- Modify: `tests/upstream-check.spec.ts`

**Interfaces:**
- Scheduled output: one open issue labeled `upstream-review` and `maintenance`.
- No code write permission and no pull-request creation.

- [ ] **Step 1: Add a workflow contract test**

Read `.github/workflows/upstream-audit.yml` as text and assert:

- `contents: read`;
- `issues: write`;
- no `contents: write`;
- no `pull-requests: write`;
- every `uses:` value ends in `@[0-9a-f]{40}`;
- the workflow runs `bun run upstream:check`;
- the workflow uses `gh issue create` or `gh issue edit`, never `gh pr create`.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/upstream-check.spec.ts --project=chromium
```

Expected: workflow file missing.

- [ ] **Step 3: Create the workflow**

Use:

```yaml
name: Upstream audit

on:
  schedule:
    - cron: '17 4 * * 1'
  workflow_dispatch:

permissions:
  contents: read
  issues: write

jobs:
  report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5 # v4
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2
        with:
          bun-version: 1.3.5
      - run: bun install --frozen-lockfile
      - run: bun run upstream:check -- --output /tmp/upstream-report.md
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Then use `gh` to create missing labels and update one existing open issue:

```bash
gh label create upstream-review --color 5319e7 --description 'Review changes from Microsoft upstream' --force
gh label create maintenance --color 0e8a16 --description 'Repository maintenance' --force
issue=$(gh issue list --state open --label upstream-review --json number --jq '.[0].number // empty')
if [[ -n "$issue" ]]; then
  gh issue edit "$issue" --title 'Review Microsoft Playwright MCP changes' --body-file /tmp/upstream-report.md
else
  gh issue create --title 'Review Microsoft Playwright MCP changes' --body-file /tmp/upstream-report.md --label upstream-review --label maintenance
fi
```

Set `GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` only on the issue-update step.

- [ ] **Step 4: Verify GREEN**

```bash
bunx playwright test tests/upstream-check.spec.ts --project=chromium
bun run lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/upstream-audit.yml tests/upstream-check.spec.ts
git commit -m "ci: add weekly upstream audit"
```

---

### Task 4: Document policy and enforce source attribution

**Files:**
- Create: `docs/upstream-policy.md`
- Create: `docs/upstream-compatibility.md`
- Modify: `src/tools/catalog/registry.ts`
- Modify: `tests/tool-registry.spec.ts`
- Modify: `README.md`

**Interfaces:**
- Registry rejects malformed `upstreamSource` metadata.
- Documentation records ported, already-covered, deferred, and rejected behavior.

- [ ] **Step 1: Write failing attribution tests**

Add:

```ts
test('registry requires a full SHA for upstream attribution', () => {
  expect(
    () =>
      new ToolRegistry([
        {
          tool: sample,
          group: 'inspection',
          aliases: [],
          keywords: [],
          bootstrap: false,
          upstreamSource: {
            repository: 'microsoft/playwright-mcp',
            commit: 'main',
            path: 'packages/playwright-core/src/tools/backend/find.ts',
          },
        },
      ])
  ).toThrow('Invalid upstream commit for browser_sample');
});
```

Also reject empty repository or absolute/parent-traversal paths.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/tool-registry.spec.ts --project=chromium
```

Expected: no validation error yet.

- [ ] **Step 3: Add registry validation**

Validate:

```ts
const FULL_SHA = /^[0-9a-f]{40}$/u;
const SAFE_REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u;
```

Reject source paths that start with `/` or contain `..` path segments.

- [ ] **Step 4: Write the policy**

`docs/upstream-policy.md` must contain an explicit checklist:

- source SHA/path recorded;
- test written before port;
- security review completed where applicable;
- local response/expectation behavior preserved;
- lint/format/release files excluded;
- dependency bump isolated;
- compatibility matrix updated;
- full CI and SonarQube pass.

`docs/upstream-compatibility.md` begins with the values from `upstream.json` and a table with columns `Feature`, `Status`, `Local implementation`, `Upstream source`, and `Notes`.

- [ ] **Step 5: Link from README**

Add a `Maintenance and upstream compatibility` section linking both documents and clarifying that this package is independently maintained rather than automatically rebased.

- [ ] **Step 6: Run full validation**

```bash
bun run build:publish
bun run lint
bunx playwright test tests/upstream-check.spec.ts tests/tool-registry.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 7: Commit and open the PR**

```bash
git add docs/upstream-policy.md docs/upstream-compatibility.md src/tools/catalog/registry.ts tests/tool-registry.spec.ts README.md
git commit -m "docs: define upstream porting policy"
```

Suggested PR title:

```text
chore: add upstream compatibility tracking
```

The PR body includes a fixture report, workflow permissions, and confirmation that no production code is automatically changed.
