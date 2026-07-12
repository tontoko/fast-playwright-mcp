# Selected Upstream Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the highest-value Microsoft Playwright MCP interoperability, security, and context-control improvements while preserving this repository's adaptive catalog, expectation controls, selector model, and Ultracite/Biome conventions.

**Architecture:** Upgrade Playwright dependencies in an isolated commit, extend the existing configuration pipeline with typed options, and port each upstream behavior behind focused tests. Every port records its upstream commit/path in `docs/upstream-compatibility.md`; no upstream formatter, linter, generated README, or release automation is imported.

**Tech Stack:** TypeScript, Bun, Playwright 1.62 alpha, MCP SDK 1.25.2, Zod, Playwright Test, Node HTTP, Ultracite/Biome.

## Global Constraints

- Depends on the adaptive-catalog and upstream-tracking plans.
- Playwright packages are pinned together to `1.62.0-alpha-1783623505000`.
- Dependency updates are isolated from behavioral changes.
- All new CLI options have config-file and environment equivalents and typed public declarations.
- Networking, file-system, secret, and executable changes require negative tests.
- Existing expectation controls and enhanced selectors remain supported.
- Do not import upstream ESLint, formatting, generated README, release, or package-management files.
- Each port records a full upstream SHA and source path.
- `browser_find` is delivered by the adaptive-catalog plan and is not reimplemented here.

---

## File Structure

**Create**

- `src/output-manager.ts` — output directory resolution and size-based eviction.
- `src/utils/secret-redactor.ts` — deterministic longest-first literal redaction.
- `tests/upstream-config.spec.ts` — public/CLI/environment option tests.
- `tests/http-allowed-hosts.spec.ts` — DNS-rebinding protection tests.
- `tests/output-manager.spec.ts` — output budget tests.
- `tests/secret-redaction.spec.ts` — response redaction tests.
- `tests/upstream-timeouts.spec.ts` — heartbeat, action, navigation, and expectation timeout tests.

**Modify**

- `package.json` / `bun.lock` — Playwright dependency pins.
- `config.d.ts` — new typed configuration fields.
- `src/config.ts` — parsing, merging, and defaults.
- `src/program.ts` — CLI options.
- `src/browser-context-factory.ts` — CDP headers/timeout and test-id configuration.
- `src/mcp/server.ts` — configurable heartbeat timeout.
- `src/mcp/transport.ts` — Host-header protection.
- `src/http-server.ts` — allowed-host helpers if shared with extension tests.
- `src/context.ts` — page/context timeout and test-id application.
- `src/tab.ts` — configured page timeouts.
- `src/response.ts` — secret redaction and `codegen: 'none'`.
- `src/tools/screenshot.ts` — screenshot scale option.
- `tests/cdp.spec.ts`, `tests/http.spec.ts`, `tests/screenshot.spec.ts`, `tests/config.spec.ts`, `tests/response-filtering.spec.ts` — conformance coverage.
- `docs/upstream-compatibility.md` — source/status matrix.
- `README.md` — user-facing configuration.

---

### Task 1: Upgrade the Playwright dependency set in isolation

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Test: existing build and smoke suites

**Interfaces:**
- Produces: matching `playwright`, `playwright-core`, and `@playwright/test` versions.

- [ ] **Step 1: Add a dependency consistency test**

Create this test in `tests/upstream-config.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import packageJSON from '../package.json' with { type: 'json' };

test('Playwright runtime and test packages use the same pinned version', () => {
  const version = '1.62.0-alpha-1783623505000';
  expect(packageJSON.dependencies.playwright).toBe(version);
  expect(packageJSON.dependencies['playwright-core']).toBe(version);
  expect(packageJSON.devDependencies['@playwright/test']).toBe(version);
});
```

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/upstream-config.spec.ts --project=chromium
```

Expected: version assertions fail on `1.58.0-alpha-1766189059000`.

- [ ] **Step 3: Pin all three packages**

Change `package.json` to:

```json
"playwright": "1.62.0-alpha-1783623505000",
"playwright-core": "1.62.0-alpha-1783623505000",
"@playwright/test": "1.62.0-alpha-1783623505000"
```

Run:

```bash
bun install
bunx playwright install chromium firefox webkit
```

- [ ] **Step 4: Resolve only compatibility failures**

Run:

```bash
bun run build:publish
bunx playwright test tests/upstream-config.spec.ts tests/library.spec.ts tests/launch.spec.ts --project=chromium
```

If internal import paths changed, update only the importing module and add a focused test. Do not copy upstream source trees.

- [ ] **Step 5: Verify GREEN**

Expected: build and focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src tests/upstream-config.spec.ts
git commit -m "chore: update Playwright dependency set"
```

---

### Task 2: Extend the typed configuration and CLI surface

**Files:**
- Modify: `config.d.ts`
- Modify: `src/config.ts`
- Modify: `src/program.ts`
- Test: `tests/upstream-config.spec.ts`
- Test: `tests/config.spec.ts`

**Interfaces:**
- Produces: `cdpHeaders`, `cdpTimeout`, `server.allowedHosts`, `outputMaxSize`, `secrets`, `testIdAttribute`, `timeouts`, and `codegen`.

- [ ] **Step 1: Write failing merge and parser tests**

Add assertions for this config:

```ts
const config: Config = {
  browser: {
    cdpHeaders: { Authorization: 'Bearer test' },
    cdpTimeout: 12_345,
  },
  server: { allowedHosts: ['localhost', '127.0.0.1'] },
  outputMaxSize: 10_000_000,
  secrets: { API_TOKEN: 'super-secret' },
  testIdAttribute: 'data-qa',
  timeouts: { action: 7000, navigation: 80_000, expect: 9000 },
  codegen: 'none',
};
```

Assert `resolveConfig(config)` preserves every value. Add invalid parser tests for negative timeouts, zero/negative output limits, malformed headers, and unknown codegen values.

- [ ] **Step 2: Verify RED**

```bash
bun run build:publish
bunx playwright test tests/upstream-config.spec.ts tests/config.spec.ts --project=chromium
```

Expected: missing properties/parsers.

- [ ] **Step 3: Add public declarations**

Add to `config.d.ts`:

```ts
browser?: {
  cdpHeaders?: Record<string, string>;
  cdpTimeout?: number;
  // existing fields
};
server?: {
  allowedHosts?: string[];
  // existing fields
};
outputMaxSize?: number;
secrets?: Record<string, string>;
testIdAttribute?: string;
timeouts?: {
  action?: number;
  navigation?: number;
  expect?: number;
};
codegen?: 'typescript' | 'none';
```

- [ ] **Step 4: Add CLI options**

Add exact options in `src/program.ts`:

```ts
.option('--cdp-header <headers...>', 'CDP headers as Name: Value pairs', headerParser)
.option('--cdp-timeout <timeout>', 'CDP connection timeout in milliseconds', positiveNumber)
.option('--allowed-hosts <hosts...>', 'allowed HTTP Host header values', commaSeparatedList)
.option('--output-max-size <bytes>', 'maximum output directory size in bytes', positiveNumber)
.option('--secrets <path>', 'dotenv file containing response-redaction secrets')
.option('--test-id-attribute <attribute>', 'attribute used by getByTestId')
.option('--timeout-action <timeout>', 'default action timeout in milliseconds', positiveNumber)
.option('--timeout-navigation <timeout>', 'default navigation timeout in milliseconds', positiveNumber)
.option('--timeout-expect <timeout>', 'default expectation timeout in milliseconds', positiveNumber)
.option('--codegen <mode>', 'code output mode: typescript or none', parseCodegen)
```

Implement `headerParser` so repeated values become a `Record<string, string>` and reject missing `:` or empty names.

- [ ] **Step 5: Add environment support**

Use these names:

```text
PLAYWRIGHT_MCP_CDP_HEADERS
PLAYWRIGHT_MCP_CDP_TIMEOUT
PLAYWRIGHT_MCP_ALLOWED_HOSTS
PLAYWRIGHT_MCP_OUTPUT_MAX_SIZE
PLAYWRIGHT_MCP_SECRETS
PLAYWRIGHT_MCP_TEST_ID_ATTRIBUTE
PLAYWRIGHT_MCP_TIMEOUT_ACTION
PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION
PLAYWRIGHT_MCP_TIMEOUT_EXPECT
PLAYWRIGHT_MCP_CODEGEN
```

Header environment input is semicolon-separated `Name: Value` pairs. Secrets load from a dotenv file with the existing `dotenv` dependency; reject files over 1 MiB and empty secret values.

- [ ] **Step 6: Merge nested config safely**

Extend `mergeConfig` to merge `browser`, `server`, `network`, and `timeouts` independently. `FullConfig` supplies defaults:

```ts
codegen: 'typescript',
outputMaxSize: 0,
testIdAttribute: 'data-testid',
timeouts: { action: 5000, navigation: 60_000, expect: 5000 },
```

`outputMaxSize: 0` means eviction disabled.

- [ ] **Step 7: Verify GREEN**

```bash
bun run build:publish
bunx playwright test tests/upstream-config.spec.ts tests/config.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add config.d.ts src/config.ts src/program.ts tests/upstream-config.spec.ts tests/config.spec.ts
git commit -m "feat: add upstream-compatible configuration options"
```

---

### Task 3: Port configurable heartbeat and CDP connection options

**Files:**
- Modify: `src/mcp/server.ts`
- Modify: `src/browser-context-factory.ts`
- Test: `tests/upstream-timeouts.spec.ts`
- Test: `tests/cdp.spec.ts`

**Interfaces:**
- Produces: `resolveHeartbeatTimeout(env): number`.
- CDP connect consumes `headers` and `timeout`.

- [ ] **Step 1: Write failing heartbeat tests**

Create:

```ts
import { expect, test } from '@playwright/test';
import { resolveHeartbeatTimeout } from '../src/mcp/server.js';

test('heartbeat defaults to 5000ms', () => {
  expect(resolveHeartbeatTimeout(undefined)).toBe(5000);
});

test('heartbeat can be disabled with zero', () => {
  expect(resolveHeartbeatTimeout('0')).toBe(0);
});

test('invalid heartbeat values use the default', () => {
  expect(resolveHeartbeatTimeout('invalid')).toBe(5000);
});
```

- [ ] **Step 2: Write failing CDP tests**

In `tests/cdp.spec.ts`, start a small HTTP server that records upgrade/request headers or mock `chromium.connectOverCDP` through a narrow exported helper. Assert the helper receives:

```ts
{
  headers: { Authorization: 'Bearer test' },
  timeout: 12_345,
}
```

- [ ] **Step 3: Verify RED**

```bash
bunx playwright test tests/upstream-timeouts.spec.ts tests/cdp.spec.ts --project=chromium
```

Expected: missing export/options.

- [ ] **Step 4: Implement heartbeat resolution**

In `src/mcp/server.ts`:

```ts
const DEFAULT_PING_TIMEOUT = 5000;

export function resolveHeartbeatTimeout(value: string | undefined): number {
  if (value === undefined) return DEFAULT_PING_TIMEOUT;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_PING_TIMEOUT;
}
```

`startHeartbeat` returns immediately when the timeout is `0`, otherwise uses the resolved timeout in `Promise.race`.

- [ ] **Step 5: Pass CDP options**

Change `CdpContextFactory._doObtainBrowser`:

```ts
return chromium.connectOverCDP(this.config.browser.cdpEndpoint as string, {
  headers: this.config.browser.cdpHeaders,
  timeout: this.config.browser.cdpTimeout ?? 30_000,
});
```

- [ ] **Step 6: Verify GREEN**

```bash
bunx playwright test tests/upstream-timeouts.spec.ts tests/cdp.spec.ts --project=chromium
bun run build:publish
```

Expected: PASS.

- [ ] **Step 7: Record attribution and commit**

Update `docs/upstream-compatibility.md` with the heartbeat/CDP source paths and full upstream SHAs, then:

```bash
git add src/mcp/server.ts src/browser-context-factory.ts tests/upstream-timeouts.spec.ts tests/cdp.spec.ts docs/upstream-compatibility.md
git commit -m "feat: configure heartbeat and CDP connections"
```

---

### Task 4: Add HTTP allowed-host protection

**Files:**
- Modify: `src/mcp/transport.ts`
- Modify: `src/http-server.ts`
- Create: `tests/http-allowed-hosts.spec.ts`
- Modify: `tests/http.spec.ts`

**Interfaces:**
- Produces: `isHostAllowed(hostHeader, boundHost, allowedHosts): boolean`.

- [ ] **Step 1: Write negative and positive tests**

Cover:

- default localhost binding accepts `localhost:<port>`, `127.0.0.1:<port>`, and `[::1]:<port>`;
- default rejects `attacker.example`;
- explicit `allowedHosts: ['mcp.internal']` accepts that host;
- `['*']` disables the check;
- missing Host returns HTTP 400;
- rejected Host returns HTTP 403 before MCP parsing;
- ports are ignored for comparison;
- malformed bracketed IPv6 values are rejected.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/http-allowed-hosts.spec.ts --project=chromium
```

Expected: hostile Host is currently accepted.

- [ ] **Step 3: Implement normalized host matching**

Add to `src/http-server.ts`:

```ts
export function normalizeHostHeader(value: string): string | null {
  try {
    return new URL(`http://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isHostAllowed(
  hostHeader: string | undefined,
  boundHost: string | undefined,
  allowedHosts: readonly string[] | undefined
): boolean {
  if (!hostHeader) return false;
  if (allowedHosts?.includes('*')) return true;
  const host = normalizeHostHeader(hostHeader);
  if (!host) return false;
  const configured = allowedHosts?.map((value) => value.toLowerCase());
  if (configured?.length) return configured.includes(host);
  const defaults = new Set(['localhost', '127.0.0.1', '::1']);
  if (boundHost && boundHost !== '0.0.0.0' && boundHost !== '::') {
    defaults.add(boundHost.toLowerCase());
  }
  return defaults.has(host);
}
```

- [ ] **Step 4: Guard requests before routing**

Pass `allowedHosts` into `start`/`startHttpTransport`. At the top of the request handler:

```ts
if (!req.headers.host) {
  res.writeHead(400).end('Missing Host header');
  return;
}
if (!isHostAllowed(req.headers.host, options.host, options.allowedHosts)) {
  res.writeHead(403).end('Host not allowed');
  return;
}
```

- [ ] **Step 5: Verify GREEN**

```bash
bunx playwright test tests/http-allowed-hosts.spec.ts tests/http.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/transport.ts src/http-server.ts tests/http-allowed-hosts.spec.ts tests/http.spec.ts docs/upstream-compatibility.md
git commit -m "feat: protect HTTP transport host handling"
```

---

### Task 5: Enforce output-directory size limits

**Files:**
- Create: `src/output-manager.ts`
- Modify: `src/config.ts`
- Modify: `src/context.ts`
- Test: `tests/output-manager.spec.ts`

**Interfaces:**
- Produces: `OutputManager.reserveFile(name): Promise<string>`.
- Eviction: oldest regular files first, symlinks ignored, active target never removed.

- [ ] **Step 1: Write failing output-budget tests**

Create temporary files with controlled mtimes and assert:

- limit `0` performs no eviction;
- a 100-byte limit removes oldest files until total is at most 100 bytes;
- directories and symlinks are never followed or deleted;
- filenames remain sanitized;
- concurrent `reserveFile` calls serialize eviction with one internal promise chain.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/output-manager.spec.ts --project=chromium
```

Expected: missing module.

- [ ] **Step 3: Implement `OutputManager`**

Use `lstat`, not `stat`, and collect only `isFile()` entries. Sort by `mtimeMs`, then filename. Serialize cleanup:

```ts
private cleanup = Promise.resolve();

reserveFile(name: string): Promise<string> {
  const result = pathJoin(this.outputDir, sanitizeForFilePath(name));
  this.cleanup = this.cleanup.then(() => this.evict(result));
  return this.cleanup.then(() => result);
}
```

The manager is constructed once in `Context` from resolved output directory and `config.outputMaxSize`.

- [ ] **Step 4: Replace direct `outputFile` usage**

`Context.outputFile(name)` delegates to the manager. Keep the exported `outputFile` helper for compatibility but make it use the same directory-resolution function.

- [ ] **Step 5: Verify GREEN**

```bash
bunx playwright test tests/output-manager.spec.ts tests/screenshot.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/output-manager.ts src/config.ts src/context.ts tests/output-manager.spec.ts docs/upstream-compatibility.md
git commit -m "feat: bound output directory size"
```

---

### Task 6: Redact configured secrets from tool responses

**Files:**
- Create: `src/utils/secret-redactor.ts`
- Modify: `src/context.ts`
- Modify: `src/response.ts`
- Create: `tests/secret-redaction.spec.ts`

**Interfaces:**
- Produces: `SecretRedactor.redact(text): string`.
- Replacement format: `<redacted:NAME>`.

- [ ] **Step 1: Write failing tests**

Test:

```ts
const redactor = new SecretRedactor({
  SHORT: 'abc',
  LONG: 'abcdef',
});
expect(redactor.redact('abcdef abc')).toBe(
  '<redacted:LONG> <redacted:SHORT>'
);
```

Integration tests must place a secret in result text, generated code, console output, URL/title text, and an error. Assert no serialized text contains the plaintext. Assert image bytes are unchanged.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/secret-redaction.spec.ts --project=chromium
```

Expected: plaintext remains.

- [ ] **Step 3: Implement longest-first literal redaction**

Create `SecretRedactor` that:

- drops empty values;
- sorts entries by descending secret length then name;
- uses `split(secret).join(replacement)` rather than regex;
- returns input unchanged when no secrets exist.

- [ ] **Step 4: Apply at the serialization boundary**

Construct one redactor in `Context`. In `Response.serialize`, redact the final text parts after all result/code/snapshot/diff construction and before returning MCP content:

```ts
const text = this._context.secretRedactor.redact(response.join('\n'));
const content = [{ type: 'text', text }];
```

Also redact error strings returned directly by `src/mcp/server.ts` before serialization.

- [ ] **Step 5: Verify GREEN**

```bash
bunx playwright test tests/secret-redaction.spec.ts tests/response-filtering.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/utils/secret-redactor.ts src/context.ts src/response.ts src/mcp/server.ts tests/secret-redaction.spec.ts docs/upstream-compatibility.md
git commit -m "feat: redact configured secrets from responses"
```

---

### Task 7: Apply action/navigation/expect timeouts, test-id attribute, and codegen mode

**Files:**
- Modify: `src/context.ts`
- Modify: `src/tab.ts`
- Modify: `src/response.ts`
- Modify: `src/services/selector-resolver.ts` if test-id lookup is centralized there
- Test: `tests/upstream-timeouts.spec.ts`
- Test: `tests/type.spec.ts`

**Interfaces:**
- Page defaults consume `config.timeouts.action` and `config.timeouts.navigation`.
- Expectation operations consume `config.timeouts.expect`.
- Code output is absent when `config.codegen === 'none'`.

- [ ] **Step 1: Write failing tests**

Assert:

- `Tab` applies configured page default timeouts;
- `getByTestId`/generated selectors use `data-qa` when configured;
- a response with generated code omits the `Ran Playwright code` section when codegen is `none` even if expectation requests code;
- default behavior remains TypeScript code generation.

Use a test-only page evaluation to read internal timeout behavior only through observable operation timing, not private properties.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/upstream-timeouts.spec.ts tests/type.spec.ts --project=chromium
```

Expected: current hardcoded values/code section.

- [ ] **Step 3: Apply page defaults**

In `Tab` constructor:

```ts
page.setDefaultNavigationTimeout(context.config.timeouts.navigation);
page.setDefaultTimeout(context.config.timeouts.action);
```

Replace hardcoded `60_000` and `TIMEOUTS.DEFAULT_PAGE_TIMEOUT`.

- [ ] **Step 4: Apply test-id configuration**

Set Playwright's test-id attribute once during browser-context setup:

```ts
playwright.selectors.setTestIdAttribute(this.config.testIdAttribute);
```

Guard against conflicting active contexts by requiring the same attribute for concurrently alive contexts; reject a conflicting value with a clear error rather than silently changing global selector state.

- [ ] **Step 5: Suppress code generation**

In `Response._addCodeSectionToResponse`:

```ts
if (
  this._context.config.codegen === 'none' ||
  !this._code.length ||
  !this._expectation.includeCode
) {
  return;
}
```

Use `config.timeouts.expect` anywhere expectation polling currently uses a hardcoded timeout.

- [ ] **Step 6: Verify GREEN**

```bash
bunx playwright test tests/upstream-timeouts.spec.ts tests/type.spec.ts tests/tools-expectation-integration.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/context.ts src/tab.ts src/response.ts src/services/selector-resolver.ts tests/upstream-timeouts.spec.ts tests/type.spec.ts docs/upstream-compatibility.md
git commit -m "feat: configure browser timeouts and code generation"
```

---

### Task 8: Add screenshot scale selection

**Files:**
- Modify: `src/tools/screenshot.ts`
- Modify: `tests/screenshot.spec.ts`

**Interfaces:**
- Input: `scale?: 'css' | 'device'`, default `css`.

- [ ] **Step 1: Write failing tests**

Add one test for default CSS scale and one for `scale: 'device'`. Assert generated Playwright code and saved image dimensions under a context with `deviceScaleFactor: 2`.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/screenshot.spec.ts --project=chromium
```

Expected: input schema rejects `scale`.

- [ ] **Step 3: Add the schema and option**

Add:

```ts
scale: z
  .enum(['css', 'device'])
  .optional()
  .default('css')
  .describe('Use CSS pixels or device pixels for the screenshot.'),
```

Pass `params.scale` to `createScreenshotOptions` and use it instead of the hardcoded `'css'`.

- [ ] **Step 4: Verify GREEN across browser projects**

```bash
bunx playwright test tests/screenshot.spec.ts --project=chrome
bunx playwright test tests/screenshot.spec.ts --project=firefox
bunx playwright test tests/screenshot.spec.ts --project=webkit
```

Expected: PASS, with browser-specific dimension assertions only where device scaling is supported consistently.

- [ ] **Step 5: Commit**

```bash
git add src/tools/screenshot.ts tests/screenshot.spec.ts docs/upstream-compatibility.md
git commit -m "feat: configure screenshot pixel scale"
```

---

### Task 9: Complete documentation and full conformance validation

**Files:**
- Modify: `README.md`
- Modify: `docs/upstream-compatibility.md`
- Modify: `utils/update-readme.js`
- Test: complete repository suites

**Interfaces:**
- Publishes exact CLI/config/environment behavior and compatibility sources.

- [ ] **Step 1: Update generated option documentation**

Ensure every new option appears in `--help` and README generation. Add concise examples for CDP headers, allowed hosts, secrets, timeouts, codegen, output limit, and screenshot scale.

- [ ] **Step 2: Complete the compatibility matrix**

For each port, record:

- status `ported`;
- local files/tests;
- upstream repository, full commit, and source path;
- intentional differences.

Mark `browser_find` as delivered by the adaptive-catalog PR rather than duplicating it.

- [ ] **Step 3: Regenerate and lint**

```bash
bun run update-readme
bun run lint-fix
bun run lint
```

Expected: no uncommitted formatter output after lint.

- [ ] **Step 4: Run the full matrix**

```bash
bun run build:publish
bun run benchmark:tools -- --check
bunx playwright test --project=chrome
bunx playwright test --project=chromium
bunx playwright test --project=msedge
bunx playwright test --project=firefox
bunx playwright test --project=webkit
npm ci --prefix extension
npm run build --prefix extension
xvfb-run --auto-servernum bunx playwright test --config=extension/playwright.config.ts
```

Expected: all pass.

- [ ] **Step 5: Run security-negative tests explicitly**

```bash
bunx playwright test tests/http-allowed-hosts.spec.ts tests/output-manager.spec.ts tests/secret-redaction.spec.ts tests/cdp.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 6: Commit and open the PR**

```bash
git add README.md docs/upstream-compatibility.md utils/update-readme.js
git commit -m "docs: document ported upstream capabilities"
```

Suggested PR title:

```text
feat: port selected upstream MCP capabilities
```

The PR body lists each upstream source SHA/path, dependency versions, security-negative tests, and all browser-matrix results.
