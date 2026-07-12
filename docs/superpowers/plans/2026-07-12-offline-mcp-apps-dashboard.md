# Offline MCP Apps Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace PR #26 with an opt-in MCP Apps dashboard that works without external network dependencies and exposes only screenshot preview, tab listing, connection state, and explicit tab selection.

**Architecture:** Add optional MCP resource handlers only when the `apps` capability is enabled. Build the dashboard client and pinned MCP Apps bridge into a deterministic single HTML resource using esbuild, inline exact-hash CSP-approved JavaScript/CSS, and render all page-controlled data through DOM nodes and `textContent`.

**Tech Stack:** TypeScript, Bun, esbuild, `@modelcontextprotocol/ext-apps` 1.0.1, MCP SDK resource APIs, Playwright Test, Ultracite/Biome.

## Global Constraints

- Capability is opt-in as `apps`; no dashboard resource is advertised by default.
- Resource handlers are registered only when both listing and reading implementations exist.
- Resource URI is `ui://dashboard`.
- No CDN, remote script, runtime fetch, or external image request.
- Strict CSP uses exact SHA-256 hashes for inline script and style.
- No `innerHTML`, `outerHTML`, `insertAdjacentHTML`, or interpolation of tab titles, URLs, errors, or tool results into markup.
- Initial operations are limited to `browser_take_screenshot`, `browser_tab_list`, and `browser_tab_select`.
- No periodic polling; refresh occurs on initial load and explicit user action only.
- Screenshot data is accepted only for `image/png`, `image/jpeg`, or `image/webp` MCP image content.
- PR #26 is not merged; it is superseded only after the replacement PR is verified.
- Keep local lint/format/build conventions.

---

## File Structure

**Create**

- `src/apps/dashboard/template.html` — static document with build placeholders only.
- `src/apps/dashboard/style.css` — dashboard styles.
- `src/apps/dashboard/client.ts` — MCP Apps client and event handlers.
- `src/apps/dashboard/render.ts` — safe parsing/rendering functions.
- `src/apps/dashboard/resource.ts` — resource descriptor and reader.
- `src/apps/generated/dashboard.ts` — deterministic generated HTML constant.
- `scripts/build-dashboard.ts` — esbuild/CSP generator.
- `tests/mcp-resources.spec.ts` — server resource contract tests.
- `tests/dashboard-build.spec.ts` — deterministic/offline/CSP tests.
- `tests/dashboard-render.spec.ts` — XSS-sensitive rendering tests.
- `tests/dashboard-e2e.spec.ts` — browser load and no-external-request test.

**Modify**

- `package.json` / `bun.lock` — pin build dependency and add scripts.
- `config.d.ts` — add `apps` capability.
- `src/mcp/server.ts` — optional resource capability and handlers.
- `src/browser-server-backend.ts` — conditionally attach resource functions.
- `src/program.ts` / `src/config.ts` — document/parse `apps` in capabilities.
- `utils/update-readme.js` / `README.md` — capability and usage docs.
- `.github/workflows/ci.yml` — deterministic dashboard build check and offline test.

---

### Task 1: Implement the complete resource-handler contract

**Files:**
- Modify: `src/mcp/server.ts`
- Create: `tests/mcp-resources.spec.ts`

**Interfaces:**
- `ServerBackend.resources?(): Resource[]`.
- `ServerBackend.readResource?(uri): Promise<ResourceContents[]>`.
- Server advertises resources only when both functions exist.

- [ ] **Step 1: Write failing server contract tests**

Create a minimal backend factory and in-memory client/server transport. Test three cases:

1. neither function exists: no resource capability and `listResources` is unsupported;
2. only `resources` exists: no resource capability and no handler;
3. both exist: `listResources` returns `ui://dashboard` and `readResource` returns HTML;
4. unknown URI rejects with `Resource not found: <uri>`.

Use this backend shape:

```ts
const backend: ServerBackend = {
  name: 'test',
  version: '1.0.0',
  tools: () => [],
  resolveTool: () => undefined,
  callTool: async () => ({ content: [] }),
  resources: () => [
    {
      uri: 'ui://dashboard',
      name: 'Browser dashboard',
      mimeType: 'text/html',
    },
  ],
  readResource: async (uri) => {
    if (uri !== 'ui://dashboard') {
      throw new Error(`Resource not found: ${uri}`);
    }
    return [{ uri, mimeType: 'text/html', text: '<!doctype html>' }];
  },
};
```

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/mcp-resources.spec.ts --project=chromium
```

Expected: resource types/handlers do not exist.

- [ ] **Step 3: Add typed optional functions**

Import `Resource`, `ResourceContents`, `ServerCapabilities`, `ListResourcesRequestSchema`, and `ReadResourceRequestSchema` from the MCP SDK. Extend `ServerBackend` with the two optional methods.

Build capabilities:

```ts
const supportsResources = Boolean(backend.resources && backend.readResource);
const capabilities: ServerCapabilities = {
  tools: backend.supportsToolListChanges ? { listChanged: true } : {},
  ...(supportsResources ? { resources: {} } : {}),
};
```

- [ ] **Step 4: Register handlers from narrowed locals**

Avoid optional chaining/non-null assertions after the check:

```ts
const listResources = backend.resources;
const readResource = backend.readResource;
if (listResources && readResource) {
  server.setRequestHandler(ListResourcesRequestSchema, () => ({
    resources: listResources(),
  }));
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
    contents: await readResource(request.params.uri),
  }));
}
```

- [ ] **Step 5: Verify GREEN**

```bash
bunx playwright test tests/mcp-resources.spec.ts --project=chromium
bun run build:publish
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/mcp/server.ts tests/mcp-resources.spec.ts
git commit -m "feat: add optional MCP resource handlers"
```

---

### Task 2: Build a deterministic self-contained dashboard resource

**Files:**
- Create: `src/apps/dashboard/template.html`
- Create: `src/apps/dashboard/style.css`
- Create: `src/apps/dashboard/client.ts`
- Create: `src/apps/generated/dashboard.ts`
- Create: `scripts/build-dashboard.ts`
- Create: `tests/dashboard-build.spec.ts`
- Modify: `package.json`
- Modify: `bun.lock`

**Interfaces:**
- Produces: `DASHBOARD_HTML` string.
- Build command: `bun run build:dashboard`.

- [ ] **Step 1: Write failing build tests**

Assert generated HTML:

- starts with `<!doctype html>`;
- contains `Content-Security-Policy`;
- contains no `http://`, `https://`, `//cdn`, `esm.sh`, or `<script src=`;
- has exactly one inline script and one inline style;
- CSP contains exact `sha256-...` tokens for the script and style contents;
- two consecutive builds are byte-identical.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/dashboard-build.spec.ts --project=chromium
```

Expected: generated module missing.

- [ ] **Step 3: Pin the dashboard build dependency**

Add to dev dependencies:

```json
"@modelcontextprotocol/ext-apps": "1.0.1"
```

Keep existing `esbuild` and run:

```bash
bun install
```

- [ ] **Step 4: Create the static template and stylesheet**

`template.html` contains only fixed elements and these exact placeholders:

```html
<meta http-equiv="Content-Security-Policy" content="__CSP__">
<style>__STYLE__</style>
<script type="module">__SCRIPT__</script>
```

Use semantic headings, buttons, status with `role="status"`, errors with `role="alert"`, an image with empty initial `src`, and a list for tabs. Do not include dynamic HTML placeholders.

- [ ] **Step 5: Implement the build script**

Bundle `client.ts`:

```ts
const result = await build({
  entryPoints: ['src/apps/dashboard/client.ts'],
  bundle: true,
  format: 'esm',
  minify: true,
  platform: 'browser',
  write: false,
});
```

Read CSS/template, replace any literal `</script` in the bundle with `<\\/script`, calculate:

```ts
const hash = (value: string) =>
  `sha256-${createHash('sha256').update(value).digest('base64')}`;
```

Set CSP exactly:

```text
default-src 'none'; img-src data:; script-src '<script hash>'; style-src '<style hash>'; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'
```

Write `src/apps/generated/dashboard.ts` using `JSON.stringify(html)`:

```ts
// Generated by scripts/build-dashboard.ts. Do not edit.
export const DASHBOARD_HTML = <JSON string>;
```

- [ ] **Step 6: Add build scripts**

Add:

```json
"build:dashboard": "bun scripts/build-dashboard.ts"
```

Prefix both `build` and `build:publish` with `bun run build:dashboard &&`.

- [ ] **Step 7: Verify GREEN and determinism**

```bash
bun run build:dashboard
cp src/apps/generated/dashboard.ts /tmp/dashboard-1.ts
bun run build:dashboard
diff -u /tmp/dashboard-1.ts src/apps/generated/dashboard.ts
bunx playwright test tests/dashboard-build.spec.ts --project=chromium
```

Expected: empty diff and PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock src/apps/dashboard/template.html src/apps/dashboard/style.css src/apps/dashboard/client.ts src/apps/generated/dashboard.ts scripts/build-dashboard.ts tests/dashboard-build.spec.ts
git commit -m "build: bundle the dashboard offline"
```

---

### Task 3: Implement safe rendering and limited dashboard operations

**Files:**
- Create: `src/apps/dashboard/render.ts`
- Modify: `src/apps/dashboard/client.ts`
- Create: `tests/dashboard-render.spec.ts`

**Interfaces:**
- Produces: `parseTabLines`, `renderTabs`, `renderError`, `renderScreenshot`.
- Allowed tool names are a closed constant set.

- [ ] **Step 1: Write XSS-sensitive rendering tests**

Test input including:

```text
- 0: [<img src=x onerror=alert(1)>] (https://example.test/?q=<script>)
```

Assert rendered DOM has one `li`, text contains the literal angle-bracket content, and no `img` or `script` descendant exists. Also assert an error string containing HTML remains text.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/dashboard-render.spec.ts --project=chromium
```

Expected: render module missing.

- [ ] **Step 3: Implement pure parsing and DOM rendering**

Use:

```ts
export type TabEntry = {
  index: number;
  label: string;
};

export function parseTabLines(text: string): TabEntry[] {
  return text
    .split('\n')
    .map((line) => /^-\s+(\d+):\s+(.+)$/u.exec(line.trim()))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({ index: Number(match[1]), label: match[2] }));
}
```

`renderTabs` creates `li`, `span`, and `button` elements with `document.createElement` and `textContent`; the button callback receives only the numeric index. No HTML string APIs are allowed.

`renderScreenshot` accepts only image content with MIME types in:

```ts
const ALLOWED_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);
```

- [ ] **Step 4: Limit client calls**

In `client.ts`:

```ts
const ALLOWED_TOOLS = Object.freeze({
  screenshot: 'browser_take_screenshot',
  listTabs: 'browser_tab_list',
  selectTab: 'browser_tab_select',
} as const);
```

Initial/refresh flow calls screenshot and tab list once. Selecting a tab calls `browser_tab_select` and then refreshes. All calls request compact expectations (`includeSnapshot: false`, `includeTabs: false`, `includeCode: false`, `includeConsole: false`).

There is no `setInterval`, recursive timeout, arbitrary tool-name input, or generic execution field.

- [ ] **Step 5: Verify GREEN**

```bash
bun run build:dashboard
bunx playwright test tests/dashboard-render.spec.ts tests/dashboard-build.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/apps/dashboard/render.ts src/apps/dashboard/client.ts src/apps/generated/dashboard.ts tests/dashboard-render.spec.ts
git commit -m "feat: add safe dashboard rendering"
```

---

### Task 4: Expose the dashboard only under the apps capability

**Files:**
- Create: `src/apps/dashboard/resource.ts`
- Modify: `config.d.ts`
- Modify: `src/browser-server-backend.ts`
- Modify: `src/program.ts`
- Modify: `src/config.ts`
- Modify: `tests/mcp-resources.spec.ts`

**Interfaces:**
- Produces: `DASHBOARD_RESOURCE_URI = 'ui://dashboard'`.
- Browser backend optional `resources`/`readResource` properties exist only when `apps` is enabled.

- [ ] **Step 1: Write failing capability tests**

Start clients with and without `--caps=apps`. Assert:

- default `listResources` is unsupported;
- apps mode lists exactly one resource;
- resource descriptor is `{ uri: 'ui://dashboard', name: 'Browser dashboard', mimeType: 'text/html' }`;
- reading it returns `DASHBOARD_HTML`;
- unknown URI is rejected.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/mcp-resources.spec.ts --project=chromium
```

Expected: apps capability/resource missing.

- [ ] **Step 3: Add the capability type**

Extend `ToolCapability` with `'apps'` in `config.d.ts`. Update `--caps` help text but do not treat apps as a normal tool group.

- [ ] **Step 4: Implement the resource module**

Create:

```ts
export const DASHBOARD_RESOURCE_URI = 'ui://dashboard';

export function dashboardResources(): Resource[] {
  return [
    {
      uri: DASHBOARD_RESOURCE_URI,
      name: 'Browser dashboard',
      description: 'Browser preview and tab selection.',
      mimeType: 'text/html',
    },
  ];
}

export async function readDashboardResource(
  uri: string
): Promise<ResourceContents[]> {
  if (uri !== DASHBOARD_RESOURCE_URI) {
    throw new Error(`Resource not found: ${uri}`);
  }
  return [
    { uri, mimeType: 'text/html', text: DASHBOARD_HTML },
  ];
}
```

- [ ] **Step 5: Conditionally attach backend functions**

Declare optional instance properties:

```ts
readonly resources?: () => Resource[];
readonly readResource?: (uri: string) => Promise<ResourceContents[]>;
```

In the constructor, only when `config.capabilities?.includes('apps')`:

```ts
this.resources = dashboardResources;
this.readResource = readDashboardResource;
```

Because the properties are absent otherwise, the server does not advertise resources.

- [ ] **Step 6: Verify GREEN**

```bash
bunx playwright test tests/mcp-resources.spec.ts --project=chromium
bun run build:publish
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add config.d.ts src/apps/dashboard/resource.ts src/browser-server-backend.ts src/program.ts src/config.ts tests/mcp-resources.spec.ts
git commit -m "feat: expose the dashboard as an opt-in resource"
```

---

### Task 5: Add offline browser E2E and CI integrity checks

**Files:**
- Create: `tests/dashboard-e2e.spec.ts`
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/dashboard-build.spec.ts`

**Interfaces:**
- CI fails on generated-file drift or any external dashboard request.

- [ ] **Step 1: Write the offline E2E test**

Load `DASHBOARD_HTML` into a page and record every request:

```ts
const externalRequests: string[] = [];
page.on('request', (request) => {
  if (!request.url().startsWith('data:') && request.url() !== 'about:blank') {
    externalRequests.push(request.url());
  }
});
await page.setContent(DASHBOARD_HTML);
await page.waitForTimeout(100);
expect(externalRequests).toEqual([]);
```

Assert the document contains the refresh button, preview image, tab list, status, and error region. Inject malicious tab text through the render module's public functions and reassert no executable nodes.

- [ ] **Step 2: Verify test behavior**

```bash
bun run build:dashboard
bunx playwright test tests/dashboard-e2e.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 3: Add generated-file cleanliness to CI**

Add before the package build:

```yaml
- name: Build MCP Apps dashboard
  run: bun run build:dashboard
- name: Ensure dashboard output is committed
  run: git diff --exit-code -- src/apps/generated/dashboard.ts
```

Add dashboard tests to the Chromium job and keep all action references pinned by full SHA.

- [ ] **Step 4: Run CSP and dependency audit**

```bash
bunx playwright test tests/dashboard-build.spec.ts tests/dashboard-render.spec.ts tests/dashboard-e2e.spec.ts tests/mcp-resources.spec.ts --project=chromium
bun pm audit
```

Any ext-apps advisory blocks the PR; do not suppress it.

- [ ] **Step 5: Commit**

```bash
git add tests/dashboard-e2e.spec.ts tests/dashboard-build.spec.ts .github/workflows/ci.yml
git commit -m "test: verify dashboard offline behavior"
```

---

### Task 6: Document, supersede PR #26, and validate the replacement

**Files:**
- Modify: `README.md`
- Modify: `utils/update-readme.js`
- Modify: `docs/upstream-compatibility.md`
- Review: PR #26 threads and comments

**Interfaces:**
- User configuration uses `--caps=apps`.
- PR #26 is closed only after this replacement PR passes all checks.

- [ ] **Step 1: Document usage and security properties**

Add:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@tontoko/fast-playwright-mcp@latest",
        "--caps=apps"
      ]
    }
  }
}
```

Document that the dashboard is bundled, offline, manually refreshed, and limited to preview/tab selection.

- [ ] **Step 2: Regenerate and lint**

```bash
bun run update-readme
bun run build:dashboard
bun run lint-fix
bun run lint
```

Expected: clean output.

- [ ] **Step 3: Run the full validation matrix**

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

- [ ] **Step 4: Commit documentation**

```bash
git add README.md utils/update-readme.js docs/upstream-compatibility.md src/apps/generated/dashboard.ts
git commit -m "docs: document the MCP Apps dashboard"
```

- [ ] **Step 5: Open the replacement PR**

Suggested title:

```text
feat: add offline MCP Apps dashboard
```

The PR body credits PR #26, lists resolved review concerns, includes CSP/offline test evidence, and does not use exaggerated language.

- [ ] **Step 6: Resolve and close PR #26 after replacement readiness**

After all replacement checks pass:

1. reply to each unresolved PR #26 thread with the replacement PR/file/test;
2. resolve the threads;
3. comment that PR #26 is superseded, with attribution;
4. close PR #26 without merging.
