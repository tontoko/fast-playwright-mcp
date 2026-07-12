# Conformance and Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that the adaptive catalog, selected upstream ports, extension mode, browser matrix, package output, and offline dashboard work together; prevent ready-for-review pull requests from retaining unresolved review threads; and close superseded issues/PRs with evidence.

**Architecture:** Add cross-feature black-box conformance tests, package-install smoke tests, and a GitHub review-thread gate. Publish migration and maintenance documentation from measured behavior, then perform one complete validation and closure pass after the stacked pull requests are green.

**Tech Stack:** TypeScript, Bun, Playwright Test, MCP SDK client/server transports, GitHub GraphQL API, npm pack, Docker, SonarQube Cloud.

## Global Constraints

- Depends on all preceding plans.
- Adaptive startup catalog is exactly seven tools and stays within the committed byte budget.
- Full profile retains current capability-filtered behavior.
- Hidden direct invocation and gateway invocation produce equivalent target responses.
- All external GitHub Actions references use full commit SHAs.
- A non-draft pull request may not have unresolved review threads.
- The packaged artifact, not only the source tree, must pass smoke tests.
- Issue/PR closure occurs only after the replacing pull request is merged or ready with all checks passing and explicit maintainer merge authorization remains outstanding.
- Do not mark transient failures as fixed without a successful rerun and evidence.
- PR/Issue text uses concrete technical descriptions without promotional superlatives.

---

## File Structure

**Create**

- `tests/conformance/tool-profiles.spec.ts` — adaptive/full/minimal black-box behavior.
- `tests/conformance/gateway-equivalence.spec.ts` — direct vs gateway output equivalence.
- `tests/conformance/upstream-options.spec.ts` — selected port behavior through the public CLI/config API.
- `tests/conformance/dashboard.spec.ts` — resource/operation integration.
- `tests/package-smoke.spec.ts` — packed package install and execution.
- `scripts/review-threads/types.ts` — GraphQL response types.
- `scripts/review-threads/check.ts` — unresolved-thread checker.
- `scripts/check-review-threads.ts` — CLI entry point.
- `tests/review-threads/fixtures/resolved.json` — all-resolved fixture.
- `tests/review-threads/fixtures/unresolved.json` — unresolved fixture.
- `tests/review-threads.spec.ts` — checker tests.
- `docs/migration-0.2.md` — profile and behavior migration.
- `docs/release-checklist.md` — repeatable release evidence checklist.
- `docs/architecture.md` — registry, visibility, gateway, upstream, and apps boundaries.

**Modify**

- `package.json` — typecheck, conformance, package-smoke, and review-thread scripts.
- `.github/workflows/ci.yml` — conformance, package smoke, review gate, and audit steps.
- `README.md` — link migration/architecture/maintenance docs.
- `docs/upstream-compatibility.md` — final selected-port statuses.
- PR #30, follow-up PRs, issues #5/#6/#17/#27/#29, and PR #26 — evidence comments and closure operations.

---

### Task 1: Add cross-profile black-box conformance tests

**Files:**
- Create: `tests/conformance/tool-profiles.spec.ts`
- Modify: `tests/fixtures.ts`

**Interfaces:**
- Uses only MCP client methods and public CLI/config inputs.

- [ ] **Step 1: Write startup-list tests**

For each profile, start a fresh client and assert sorted names:

```ts
const adaptive = [
  'browser_batch_execute',
  'browser_execute',
  'browser_find',
  'browser_navigate',
  'browser_query',
  'browser_snapshot',
  'browser_tools',
];

const minimal = [
  'browser_execute',
  'browser_query',
  'browser_tools',
];
```

For full, compare `client.listTools()` to `createBaseToolRegistry(resolveConfig({ toolProfile: 'full' })).names()` rather than hardcoding a list that will drift after selected upstream ports.

- [ ] **Step 2: Add session-isolation tests**

Start two adaptive clients. Enable `browser_console_messages` on client A. Assert:

- A lists the enabled tool;
- B does not;
- reset on A returns exactly seven tools;
- closing A does not affect B.

- [ ] **Step 3: Add compatibility tests**

Assert a hidden tool call succeeds before enablement:

```ts
await client.callTool({
  name: 'browser_console_messages',
  arguments: {},
});
```

Then enable it and assert the same call remains valid. Start a full-profile client and run a representative read-only, action, destructive, PDF-capability, and vision-capability tool where supported.

- [ ] **Step 4: Run the tests**

```bash
bunx playwright test tests/conformance/tool-profiles.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/conformance/tool-profiles.spec.ts tests/fixtures.ts
git commit -m "test: verify tool profile conformance"
```

---

### Task 2: Prove direct and gateway execution equivalence

**Files:**
- Create: `tests/conformance/gateway-equivalence.spec.ts`

**Interfaces:**
- Normalizes only volatile file paths and elapsed times before comparison.

- [ ] **Step 1: Write read-only equivalence tests**

Navigate once, then compare direct `browser_console_messages` with `browser_query` targeting it. Compare the full MCP content array and `isError` after applying this narrowly scoped normalizer:

```ts
function normalizeVolatileText(text: string): string {
  return text
    .replaceAll(/\/[^\s]+\/page-[^\s]+\.(png|jpeg)/gu, '<screenshot-path>')
    .replaceAll(/\b\d+ms\b/gu, '<duration>');
}
```

Do not remove headings, error messages, snapshots, or image content.

- [ ] **Step 2: Write action equivalence tests**

On identical fresh pages, compare direct `browser_click` with `browser_execute` targeting `browser_click`. Assert page state and returned content match after the same narrow normalization.

- [ ] **Step 3: Add negative separation tests**

Assert:

- query rejects click;
- execute rejects console messages;
- gateways reject themselves and batch execution;
- invalid arguments produce the same Zod field path as a direct call;
- secret redaction is identical in direct and gateway responses.

- [ ] **Step 4: Run across browsers**

```bash
bunx playwright test tests/conformance/gateway-equivalence.spec.ts --project=chrome
bunx playwright test tests/conformance/gateway-equivalence.spec.ts --project=firefox
bunx playwright test tests/conformance/gateway-equivalence.spec.ts --project=webkit
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/conformance/gateway-equivalence.spec.ts
git commit -m "test: verify gateway execution equivalence"
```

---

### Task 3: Add selected-upstream and dashboard integration conformance

**Files:**
- Create: `tests/conformance/upstream-options.spec.ts`
- Create: `tests/conformance/dashboard.spec.ts`

**Interfaces:**
- Exercises user-facing options, not private helpers.

- [ ] **Step 1: Cover upstream options through public entry points**

Use `startClient` config and CLI variants to verify:

- CDP headers and timeout reach the test server;
- hostile Host is rejected and allowed Host succeeds;
- output eviction occurs after configured size is exceeded;
- configured secrets are absent from all returned text;
- action/navigation timeouts affect observable operation timing;
- configured test-id attribute resolves the target element;
- `codegen: 'none'` removes generated code;
- screenshot scale changes dimensions where supported.

Each test cites the corresponding row in `docs/upstream-compatibility.md` through a test annotation.

- [ ] **Step 2: Cover dashboard resource and operations**

Start with `--caps=apps`, list/read `ui://dashboard`, and assert the resource is absent without the capability. Use a browser page to load the returned HTML while blocking all external requests. Mock the parent MCP Apps bridge only at the message boundary and assert the dashboard emits only these tool calls:

```ts
new Set([
  'browser_take_screenshot',
  'browser_tab_list',
  'browser_tab_select',
]);
```

Inject malicious tab text and assert literal rendering.

- [ ] **Step 3: Run conformance tests**

```bash
bunx playwright test tests/conformance/upstream-options.spec.ts tests/conformance/dashboard.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add tests/conformance/upstream-options.spec.ts tests/conformance/dashboard.spec.ts
git commit -m "test: add upstream and dashboard conformance"
```

---

### Task 4: Test the packed npm artifact

**Files:**
- Create: `tests/package-smoke.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `bun run test:package`.

- [ ] **Step 1: Write the package smoke test**

The test must:

1. run `npm pack --json` in the repository;
2. create a temporary project;
3. install the generated tarball with `npm install <tarball>`;
4. run the installed CLI with `--version` and `--help`;
5. start the installed MCP server in adaptive mode through `StdioClientTransport`;
6. assert startup `tools/list` contains exactly seven tools;
7. call `browser_tools` status;
8. close the client and remove the tarball/temp directory.

Use `spawn`/`spawnSync` with `shell: false` and explicit timeouts.

- [ ] **Step 2: Verify the test fails on the source-only assumptions**

Temporarily exclude a required generated file from the pack list or run before the dashboard generated file is committed. Confirm the test catches the missing artifact, then restore and continue. Do not commit the temporary break.

- [ ] **Step 3: Add the script**

```json
"test:package": "playwright test tests/package-smoke.spec.ts --project=chromium"
```

- [ ] **Step 4: Verify GREEN**

```bash
bun run build:publish
bun run test:package
```

Expected: PASS using only the packed artifact.

- [ ] **Step 5: Commit**

```bash
git add tests/package-smoke.spec.ts package.json
git commit -m "test: verify the packed npm artifact"
```

---

### Task 5: Prevent unresolved review threads on ready pull requests

**Files:**
- Create: `scripts/review-threads/types.ts`
- Create: `scripts/review-threads/check.ts`
- Create: `scripts/check-review-threads.ts`
- Create: `tests/review-threads/fixtures/resolved.json`
- Create: `tests/review-threads/fixtures/unresolved.json`
- Create: `tests/review-threads.spec.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- CLI: `bun run check:review-threads -- --repository owner/repo --pr 123`.
- Draft PRs report unresolved threads but exit zero; non-draft PRs fail.

- [ ] **Step 1: Write fixture-driven tests**

Fixtures model GraphQL `repository.pullRequest.isDraft` and paginated `reviewThreads.nodes[].isResolved`. Assert:

- resolved non-draft exits success;
- unresolved draft exits success with warning;
- unresolved non-draft throws `Pull request has N unresolved review thread(s)`;
- pagination continues until `hasNextPage` is false;
- outdated but unresolved threads still count until explicitly resolved.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/review-threads.spec.ts --project=chromium
```

Expected: missing modules.

- [ ] **Step 3: Implement GraphQL pagination**

Use a fixed query:

```graphql
query ReviewThreads($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    pullRequest(number: $number) {
      isDraft
      reviewThreads(first: 100, after: $after) {
        nodes { isResolved isOutdated path }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
```

Call `https://api.github.com/graphql` with `GITHUB_TOKEN`. Never print the token or response headers.

- [ ] **Step 4: Add scripts**

```json
"check:review-threads": "bun scripts/check-review-threads.ts"
```

Support `--fixture` for offline tests.

- [ ] **Step 5: Add the CI job**

Use `pull-requests: read`, `contents: read`, pinned checkout/setup-bun actions, and:

```yaml
- run: bun run check:review-threads -- --repository "${{ github.repository }}" --pr "${{ github.event.pull_request.number }}"
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 6: Verify GREEN**

```bash
bunx playwright test tests/review-threads.spec.ts --project=chromium
bun run lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/review-threads scripts/check-review-threads.ts tests/review-threads tests/review-threads.spec.ts package.json .github/workflows/ci.yml
git commit -m "ci: require resolved review threads"
```

---

### Task 6: Publish architecture, migration, and release checklists

**Files:**
- Create: `docs/migration-0.2.md`
- Create: `docs/release-checklist.md`
- Create: `docs/architecture.md`
- Modify: `README.md`
- Modify: `docs/upstream-compatibility.md`

**Interfaces:**
- Documents measured behavior and exact commands only.

- [ ] **Step 1: Write the architecture document**

Cover these boundaries with file-level references:

- immutable full registry;
- session-local visibility;
- visible `tools/list` vs full call resolution;
- read-only/action gateway separation;
- context-budget measurement;
- upstream audit vs manual porting;
- opt-in offline app resources;
- extension and standard browser factories.

Include a Mermaid diagram but keep all prose factual.

- [ ] **Step 2: Write migration guidance**

`docs/migration-0.2.md` must include:

- adaptive default behavior;
- `--tool-profile=full` rollback;
- minimal profile;
- discovery/enable examples;
- direct hidden-call compatibility;
- new security/config options;
- apps capability opt-in;
- version and Node/Bun requirements;
- known intentional differences from Microsoft upstream.

- [ ] **Step 3: Write the release checklist**

Use checkbox commands for:

```bash
bun install --frozen-lockfile
bun run build:publish
bun run lint
bun run benchmark:tools -- --check
bun run upstream:check:fixture
bun run test:package
bunx playwright test --project=chrome
bunx playwright test --project=chromium
bunx playwright test --project=msedge
bunx playwright test --project=firefox
bunx playwright test --project=webkit
npm ci --prefix extension
npm run build --prefix extension
xvfb-run --auto-servernum bunx playwright test --config=extension/playwright.config.ts
bun pm audit
```

Also require SonarQube passing, zero new issues, zero unresolved review threads, and clean `git status --short`.

- [ ] **Step 4: Link documents and refresh compatibility status**

Link all three documents from README. Ensure every selected upstream row is `ported`, `already covered`, `deferred`, or `rejected`, with no blank status/source cells.

- [ ] **Step 5: Lint and commit**

```bash
bun run lint-fix
bun run lint
git add docs/migration-0.2.md docs/release-checklist.md docs/architecture.md docs/upstream-compatibility.md README.md
git commit -m "docs: add architecture and migration guidance"
```

---

### Task 7: Run final validation and close superseded work with evidence

**Files:**
- Review: all changed code and docs
- Update: PR bodies/comments and issue/PR state

**Interfaces:**
- Produces: evidence comments and correct closure links.

- [ ] **Step 1: Run a fresh complete validation**

Run every command from `docs/release-checklist.md` in a clean checkout. Record command, exit code, duration, and relevant test count in `/tmp/release-evidence.md`.

- [ ] **Step 2: Verify repository and generated files are clean**

```bash
git diff --check
git status --short
bun run build:dashboard
git diff --exit-code -- src/apps/generated/dashboard.ts
```

Expected: no output from the git checks.

- [ ] **Step 3: Verify hosted checks**

For every follow-up PR:

- all GitHub Actions jobs pass;
- SonarQube Quality Gate passes;
- new issues and security hotspots are zero;
- review-thread checker passes when the PR is non-draft;
- any rerun is documented with the original failure and why it was transient or fixed.

- [ ] **Step 4: Update and close Issue #17**

Comment with measured adaptive/full tool counts, bytes, ratio, benchmark command, compatibility setting, and PR link. Ensure the adaptive PR body contains `Fixes #17`; close manually only if GitHub did not close it after merge.

- [ ] **Step 5: Close issues covered by PR #30 after merge**

Confirm #5, #6, #27, and #29 are closed by the merged PR. If any remains open, add a short evidence comment and close it.

- [ ] **Step 6: Supersede PR #26**

Reply to every unresolved review thread with the replacement file/test, resolve each thread, add a top-level attribution comment linking the offline dashboard PR, and close PR #26 without merging.

- [ ] **Step 7: Review the upstream tracking issue**

Ensure the latest weekly issue identifies all upstream changes after the pinned commit and that each candidate has a classification. Do not close it if unreviewed changes remain.

- [ ] **Step 8: Open the conformance PR**

Suggested title:

```text
test: complete MCP conformance and migration coverage
```

Attach `/tmp/release-evidence.md` content to the PR body, not as an untracked repository file.

- [ ] **Step 9: Mark PRs ready only after the gate passes**

Convert each draft to ready-for-review only after its unresolved-thread check, CI, SonarQube, and package smoke tests pass. Do not merge without explicit maintainer authorization.
