# Adaptive Tool Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized default static MCP tool list with a seven-tool adaptive catalog while preserving full-profile compatibility and direct invocation of hidden registered tools.

**Architecture:** Build one immutable `ToolRegistry` from every configured tool and one session-local `ToolVisibility` instance per `BrowserServerBackend`. `tools/list` returns only visible schemas, while tool calls resolve against the complete registry. Three bootstrap tools provide catalog search and schema-validated read-only/action dispatch, and the server sends `notifications/tools/list_changed` after visibility changes when supported.

**Tech Stack:** TypeScript, Bun, Zod, `@modelcontextprotocol/sdk` 1.25.2, Playwright Test, Ultracite/Biome.

## Global Constraints

- `toolProfile: 'adaptive' | 'full' | 'minimal'`; default is `adaptive`.
- Adaptive startup tools are exactly `browser_tools`, `browser_query`, `browser_execute`, `browser_batch_execute`, `browser_navigate`, `browser_snapshot`, and `browser_find`.
- The startup catalog may not exceed eight tools, 12,000 UTF-8 bytes, or 25% of the full-profile serialized size.
- `full` must preserve the current capability-filtered catalog.
- Hidden registered tools remain directly callable by name and retain their original Zod validation.
- `browser_query` may dispatch only read-only tools; `browser_execute` may dispatch only action or destructive tools.
- Gateways and batch execution may not recursively target themselves or each other.
- Catalog state is backend/session-local; no mutable global state.
- Search is deterministic and local; no network, embeddings, or external service.
- Keep the existing Ultracite/Biome rules; do not import upstream lint or formatting configuration.
- PR titles, bodies, docs, and comments use concrete technical language without promotional superlatives.

---

## File Structure

**Create**

- `src/tools/catalog/types.ts` — catalog types, groups, profile constants, and bootstrap names.
- `src/tools/catalog/registry.ts` — immutable full registry and registration validation.
- `src/tools/catalog/visibility.ts` — session-local enabled-tool state and profile filtering.
- `src/tools/catalog/search.ts` — deterministic search ranking.
- `src/tools/catalog/gateways.ts` — `browser_tools`, `browser_query`, and `browser_execute` factories.
- `src/tools/find.ts` — accessibility-snapshot search tool.
- `benchmark/tool-catalog.ts` — deterministic catalog size reporter and budget checker.
- `benchmark/tool-catalog-baseline.json` — generated full-profile size baseline.
- `tests/tool-registry.spec.ts` — registry, duplicate, and metadata tests.
- `tests/tool-visibility.spec.ts` — profile and state tests.
- `tests/tool-search.spec.ts` — ranking tests.
- `tests/tool-gateways.spec.ts` — discovery, dispatch, validation, and recursion tests.
- `tests/browser-find.spec.ts` — snapshot search integration tests.
- `tests/tool-context-budget.spec.ts` — hard context-budget tests.

**Modify**

- `config.d.ts` — add `ToolProfile`, `toolProfile`, and expanded tool capability types.
- `src/config.ts` — resolve CLI, config-file, and environment profile values.
- `src/program.ts` — add `--tool-profile`.
- `package.json` / `bun.lock` — pin the MCP SDK and add the benchmark script.
- `src/mcp/tool.ts` — add the non-destructive `action` schema type and preserve annotations.
- `src/mcp/server.ts` — separate visible-list lookup from complete-registry call lookup and support list-change notifications.
- `src/tools/tool.ts` — allow handlers to return a raw `ToolResponse` and accept an optional `AbortSignal`.
- `src/tools.ts` — replace the unstructured array export with registered tool groups.
- `src/browser-server-backend.ts` — own registry/visibility, expose visible schemas, resolve hidden tools, and notify clients.
- `src/batch/batch-executor.ts` — reject recursive gateway/batch targets and propagate cancellation.
- `src/types/batch.ts` — document and validate disallowed gateway targets.
- `tests/fixtures.ts` — expose tool-list notifications and optional tool profile configuration.
- `tests/mcp-tool-schema.spec.ts` — cover action annotations and cached compact schemas.
- `.github/workflows/ci.yml` — run the catalog budget checker.
- `README.md` — document profiles, migration, and discovery workflow.

---

### Task 1: Pin the MCP SDK and represent non-destructive actions

**Files:**
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `src/mcp/tool.ts:23-29,125-139`
- Modify: `src/mcp/server.ts:1-18`
- Test: `tests/mcp-tool-schema.spec.ts`

**Interfaces:**
- Produces: `ToolSchema['type']` as `'readOnly' | 'action' | 'destructive'`.
- Produces: MCP annotations where `action` sets both `readOnlyHint` and `destructiveHint` to `false`.

- [ ] **Step 1: Write the failing action-annotation test**

Append to `tests/mcp-tool-schema.spec.ts`:

```ts
test('action tools are neither read-only nor destructive', () => {
  const tool = toMcpTool({
    name: 'browser_action_example',
    title: 'Action example',
    description: 'Changes session state without destructive browser effects.',
    type: 'action',
    inputSchema: z.object({}),
  });

  expect(tool.annotations).toMatchObject({
    readOnlyHint: false,
    destructiveHint: false,
    openWorldHint: true,
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
bunx playwright test tests/mcp-tool-schema.spec.ts --project=chromium
```

Expected: TypeScript/build failure because `'action'` is not assignable to the current schema type.

- [ ] **Step 3: Extend the schema type and annotation mapping**

Change `ToolSchema` in both `src/mcp/tool.ts` and `src/mcp/server.ts` to:

```ts
type ToolEffect = 'readOnly' | 'action' | 'destructive';

export type ToolSchema<Input extends z.Schema> = {
  name: string;
  title: string;
  description: string;
  inputSchema: Input;
  type: ToolEffect;
};
```

Update `toMcpTool`:

```ts
annotations: {
  title: tool.title,
  readOnlyHint: tool.type === 'readOnly',
  destructiveHint: tool.type === 'destructive',
  openWorldHint: true,
},
```

- [ ] **Step 4: Pin the SDK and refresh the lockfile**

Change `package.json`:

```json
"@modelcontextprotocol/sdk": "1.25.2"
```

Run:

```bash
bun install
```

Expected: `bun.lock` records exactly `1.25.2`.

- [ ] **Step 5: Run focused tests and build**

Run:

```bash
bunx playwright test tests/mcp-tool-schema.spec.ts --project=chromium
bun run build:publish
```

Expected: PASS and successful build.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/mcp/tool.ts src/mcp/server.ts tests/mcp-tool-schema.spec.ts
git commit -m "refactor: distinguish non-destructive tool actions"
```

---

### Task 2: Add the tool-profile configuration contract

**Files:**
- Modify: `config.d.ts:21-28,87-94`
- Modify: `src/config.ts:10-66,294-306,347-415`
- Modify: `src/program.ts:48-56`
- Test: `tests/config.spec.ts`

**Interfaces:**
- Produces: `export type ToolProfile = 'adaptive' | 'full' | 'minimal'`.
- Produces: required `FullConfig.toolProfile: ToolProfile`.
- Consumes: CLI `--tool-profile` and environment `FAST_PLAYWRIGHT_TOOL_PROFILE`.

- [ ] **Step 1: Write failing configuration tests**

Append to `tests/config.spec.ts`:

```ts
test.describe('tool profile configuration', () => {
  test('defaults to adaptive', async () => {
    const { resolveConfig } = await import('../lib/config.js');
    expect(resolveConfig({}).toolProfile).toBe('adaptive');
  });

  test('accepts full from CLI options', async () => {
    const { configFromCLIOptions } = await import('../lib/config.js');
    expect(configFromCLIOptions({ toolProfile: 'full' }).toolProfile).toBe(
      'full'
    );
  });

  test('rejects an unknown profile', async () => {
    const { parseToolProfile } = await import('../lib/config.js');
    expect(() => parseToolProfile('large')).toThrow(
      'Invalid tool profile: large'
    );
  });
});
```

- [ ] **Step 2: Verify RED**

```bash
bun run build:publish
bunx playwright test tests/config.spec.ts --project=chromium
```

Expected: failure because the profile properties and parser do not exist.

- [ ] **Step 3: Add public and internal types**

Add to `config.d.ts`:

```ts
export type ToolProfile = 'adaptive' | 'full' | 'minimal';

export type Config = {
  toolProfile?: ToolProfile;
  // existing fields
};
```

Add to `src/config.ts`:

```ts
import type { Config, ToolCapability, ToolProfile } from '../config.js';

export type CLIOptions = {
  toolProfile?: ToolProfile;
  // existing fields
};

const defaultConfig: FullConfig = {
  toolProfile: 'adaptive',
  // existing fields
};

export type FullConfig = Config & {
  toolProfile: ToolProfile;
  // existing required fields
};

export function parseToolProfile(value: string): ToolProfile {
  if (value === 'adaptive' || value === 'full' || value === 'minimal') {
    return value;
  }
  throw new Error(`Invalid tool profile: ${value}`);
}
```

Include `toolProfile` in `createMiscellaneousConfig`, `mergeAllConfigParts`, and environment population:

```ts
options.toolProfile = process.env.FAST_PLAYWRIGHT_TOOL_PROFILE
  ? parseToolProfile(process.env.FAST_PLAYWRIGHT_TOOL_PROFILE)
  : undefined;
```

- [ ] **Step 4: Add the CLI option**

In `src/program.ts` add:

```ts
.option(
  '--tool-profile <profile>',
  'tool catalog profile: adaptive, full, or minimal',
  parseToolProfile
)
```

Import `parseToolProfile` from `./config.js`.

- [ ] **Step 5: Verify GREEN**

```bash
bun run build:publish
bunx playwright test tests/config.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add config.d.ts src/config.ts src/program.ts tests/config.spec.ts
git commit -m "feat: add tool catalog profiles"
```

---

### Task 3: Build the immutable tool registry

**Files:**
- Create: `src/tools/catalog/types.ts`
- Create: `src/tools/catalog/registry.ts`
- Modify: `src/tools.ts`
- Test: `tests/tool-registry.spec.ts`

**Interfaces:**
- Produces: `ToolGroup`, `ToolRegistration`, `ToolRegistry`, `registerToolGroup`.
- Produces: `createBaseToolRegistry(config: FullConfig): ToolRegistry`.

- [ ] **Step 1: Write registry tests**

Create `tests/tool-registry.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { z } from 'zod';
import { ToolRegistry, registerToolGroup } from '../src/tools/catalog/registry.js';
import { defineTool } from '../src/tools/tool.js';

const sample = defineTool({
  capability: 'core',
  schema: {
    name: 'browser_sample',
    title: 'Sample',
    description: 'Sample tool.',
    inputSchema: z.object({ value: z.string() }),
    type: 'readOnly',
  },
  async handle() {},
});

test('registry resolves tools and metadata by stable name', () => {
  const registry = new ToolRegistry(
    registerToolGroup('inspection', [sample], {
      aliases: { browser_sample: ['sample'] },
      keywords: { browser_sample: ['example'] },
    })
  );
  expect(registry.require('browser_sample').group).toBe('inspection');
  expect(registry.require('browser_sample').aliases).toEqual(['sample']);
});

test('registry rejects duplicate names', () => {
  expect(
    () =>
      new ToolRegistry([
        ...registerToolGroup('inspection', [sample]),
        ...registerToolGroup('testing', [sample]),
      ])
  ).toThrow('Duplicate tool registration: browser_sample');
});
```

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/tool-registry.spec.ts --project=chromium
```

Expected: module-not-found failure.

- [ ] **Step 3: Create catalog types**

Create `src/tools/catalog/types.ts`:

```ts
import type { AnyTool } from '../tool.js';

export type ToolGroup =
  | 'bootstrap'
  | 'navigation'
  | 'interaction'
  | 'inspection'
  | 'diagnostics'
  | 'network'
  | 'storage'
  | 'testing'
  | 'devtools'
  | 'vision'
  | 'pdf'
  | 'apps';

export type ToolRegistration = {
  tool: AnyTool;
  group: ToolGroup;
  aliases: readonly string[];
  keywords: readonly string[];
  bootstrap: boolean;
  upstreamSource?: {
    repository: string;
    commit: string;
    path: string;
  };
};
```

- [ ] **Step 4: Implement the registry**

Create `src/tools/catalog/registry.ts` with this public surface:

```ts
export class ToolRegistry {
  readonly registrations: readonly ToolRegistration[];
  private readonly byName: ReadonlyMap<string, ToolRegistration>;

  constructor(registrations: readonly ToolRegistration[]) {
    const byName = new Map<string, ToolRegistration>();
    for (const registration of registrations) {
      const name = registration.tool.schema.name;
      if (byName.has(name)) {
        throw new Error(`Duplicate tool registration: ${name}`);
      }
      byName.set(name, Object.freeze({ ...registration }));
    }
    this.registrations = Object.freeze([...byName.values()]);
    this.byName = byName;
  }

  get(name: string): ToolRegistration | undefined {
    return this.byName.get(name);
  }

  require(name: string): ToolRegistration {
    const registration = this.get(name);
    if (!registration) {
      throw new Error(`Unknown tool: ${name}`);
    }
    return registration;
  }

  names(): string[] {
    return this.registrations.map(({ tool }) => tool.schema.name);
  }
}
```

Implement `registerToolGroup(group, tools, options)` so aliases and keywords default to empty arrays and `bootstrap` is derived from an optional `bootstrapNames` set.

- [ ] **Step 5: Replace the raw catalog assembly**

In `src/tools.ts`, retain `allTools` temporarily for compatibility, and add:

```ts
export function createBaseToolRegistry(config: FullConfig): ToolRegistry {
  const enabled = (tools: AnyTool[]) =>
    tools.filter(
      (tool) =>
        tool.capability.startsWith('core') ||
        config.capabilities?.includes(tool.capability)
    );

  return new ToolRegistry([
    ...registerToolGroup('interaction', enabled(common)),
    ...registerToolGroup('inspection', enabled(consoleTools)),
    ...registerToolGroup('interaction', enabled(dialogs)),
    ...registerToolGroup('inspection', enabled(evaluate)),
    ...registerToolGroup('interaction', enabled(files)),
    ...registerToolGroup('diagnostics', enabled([browserFindElements, browserDiagnose])),
    ...registerToolGroup('inspection', enabled(inspectHtml)),
    ...registerToolGroup('interaction', enabled(install)),
    ...registerToolGroup('interaction', enabled(keyboard)),
    ...registerToolGroup('navigation', enabled(navigate)),
    ...registerToolGroup('network', enabled(network)),
    ...registerToolGroup('interaction', enabled(mouse)),
    ...registerToolGroup('pdf', enabled(pdf)),
    ...registerToolGroup('inspection', enabled(screenshot)),
    ...registerToolGroup('inspection', enabled(snapshot)),
    ...registerToolGroup('navigation', enabled(tabs)),
    ...registerToolGroup('inspection', enabled(wait)),
    ...registerToolGroup('interaction', enabled([batchExecuteTool])),
  ]);
}
```

Rename the imported `console` variable to `consoleTools` to avoid shadowing the global.

- [ ] **Step 6: Verify GREEN**

```bash
bunx playwright test tests/tool-registry.spec.ts --project=chromium
bun run build:publish
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/tools/catalog/types.ts src/tools/catalog/registry.ts src/tools.ts tests/tool-registry.spec.ts
git commit -m "refactor: centralize tool registration"
```

---

### Task 4: Implement profile visibility and deterministic search

**Files:**
- Create: `src/tools/catalog/visibility.ts`
- Create: `src/tools/catalog/search.ts`
- Test: `tests/tool-visibility.spec.ts`
- Test: `tests/tool-search.spec.ts`

**Interfaces:**
- Produces: `ADAPTIVE_BOOTSTRAP_NAMES`, `MINIMAL_BOOTSTRAP_NAMES`.
- Produces: `ToolVisibility.visible(registry)`, `enable`, `disable`, `reset`.
- Produces: `searchTools(registry, query, limit)`.

- [ ] **Step 1: Write profile tests**

Create `tests/tool-visibility.spec.ts` with assertions for the exact startup names:

```ts
const adaptiveNames = [
  'browser_batch_execute',
  'browser_execute',
  'browser_find',
  'browser_navigate',
  'browser_query',
  'browser_snapshot',
  'browser_tools',
];

expect(visibility.visible(registry).map((item) => item.tool.schema.name).sort())
  .toEqual(adaptiveNames);
```

Also test `full`, `minimal`, enable/disable/reset, unknown-name atomic failure, and two independent visibility instances.

- [ ] **Step 2: Write ranking tests**

Create `tests/tool-search.spec.ts` covering this exact score order:

1. exact tool name: 100
2. exact alias: 90
3. tool-name substring: 70
4. alias substring: 60
5. title substring: 50
6. keyword match: 30
7. description substring: 10

Assert ties sort by tool name and default results stop at six.

- [ ] **Step 3: Verify RED**

```bash
bunx playwright test tests/tool-visibility.spec.ts tests/tool-search.spec.ts --project=chromium
```

Expected: missing-module failures.

- [ ] **Step 4: Implement visibility**

Create `src/tools/catalog/visibility.ts`:

```ts
export const ADAPTIVE_BOOTSTRAP_NAMES = Object.freeze([
  'browser_tools',
  'browser_query',
  'browser_execute',
  'browser_batch_execute',
  'browser_navigate',
  'browser_snapshot',
  'browser_find',
] as const);

export const MINIMAL_BOOTSTRAP_NAMES = Object.freeze([
  'browser_tools',
  'browser_query',
  'browser_execute',
] as const);

export class ToolVisibility {
  private readonly enabled = new Set<string>();

  constructor(readonly profile: ToolProfile) {}

  visible(registry: ToolRegistry): ToolRegistration[] {
    if (this.profile === 'full') {
      return [...registry.registrations];
    }
    const bootstrap =
      this.profile === 'minimal'
        ? MINIMAL_BOOTSTRAP_NAMES
        : ADAPTIVE_BOOTSTRAP_NAMES;
    const names = new Set<string>([...bootstrap, ...this.enabled]);
    return registry.registrations.filter(({ tool }) =>
      names.has(tool.schema.name)
    );
  }

  enable(registry: ToolRegistry, names: readonly string[]): boolean {
    for (const name of names) registry.require(name);
    const before = this.enabled.size;
    for (const name of names) this.enabled.add(name);
    return before !== this.enabled.size;
  }

  disable(names: readonly string[]): boolean {
    let changed = false;
    for (const name of names) changed = this.enabled.delete(name) || changed;
    return changed;
  }

  reset(): boolean {
    const changed = this.enabled.size > 0;
    this.enabled.clear();
    return changed;
  }
}
```

Ensure disable cannot hide bootstrap names because bootstrap membership is reapplied by `visible`.

- [ ] **Step 5: Implement deterministic search**

Create `src/tools/catalog/search.ts` with a normalized lowercase scorer. Return:

```ts
export type ToolSearchResult = {
  name: string;
  title: string;
  summary: string;
  group: ToolGroup;
  type: ToolSchema['type'];
  score: number;
};
```

Exclude `browser_tools`, `browser_query`, and `browser_execute` from search results unless the query exactly names them.

- [ ] **Step 6: Verify GREEN**

```bash
bunx playwright test tests/tool-visibility.spec.ts tests/tool-search.spec.ts --project=chromium
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/tools/catalog/visibility.ts src/tools/catalog/search.ts tests/tool-visibility.spec.ts tests/tool-search.spec.ts
git commit -m "feat: add adaptive tool visibility and search"
```

---

### Task 5: Add compact accessibility-snapshot search

**Files:**
- Create: `src/tools/find.ts`
- Modify: `src/tools.ts`
- Test: `tests/browser-find.spec.ts`

**Interfaces:**
- Produces: `browserFind` read-only tool.
- Input: `{ query, regex?, caseSensitive?, maxResults?, contextLines?, expectation? }`.

- [ ] **Step 1: Write failing integration tests**

Create `tests/browser-find.spec.ts` to navigate to a page containing headings, buttons, and repeated text. Assert:

- plain text search returns matching lines and one surrounding line;
- regex search works;
- case-sensitive search differs from default search;
- repeated overlapping matches are deduplicated;
- `maxResults` is enforced;
- a no-match response contains `No snapshot matches` and does not contain the full snapshot.

Use this call shape:

```ts
const result = await client.callTool({
  name: 'browser_find',
  arguments: { query: 'Save', contextLines: 1, maxResults: 5 },
});
```

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/browser-find.spec.ts --project=chromium
```

Expected: tool-not-found failure.

- [ ] **Step 3: Implement the tool**

Create `src/tools/find.ts` with bounded schema values:

```ts
const findSchema = z.object({
  query: z.string().min(1).max(500),
  regex: z.boolean().optional().default(false),
  caseSensitive: z.boolean().optional().default(false),
  maxResults: z.number().int().min(1).max(50).optional().default(10),
  contextLines: z.number().int().min(0).max(5).optional().default(1),
  expectation: expectationSchema.optional(),
});
```

The handler captures `await tab.captureSnapshot()`, searches `ariaSnapshot.split('\n')`, expands each match to `[index - contextLines, index + contextLines]`, merges overlapping ranges, and stops after `maxResults`. Format each result as:

```text
Match 1 (lines 4-6):
  - heading "Account"
  - button "Save" [ref=e7]
  - button "Cancel" [ref=e8]
```

Catch invalid regular expressions and add an error beginning `Invalid regular expression:`.

- [ ] **Step 4: Register with attribution**

Register `browserFind` in the inspection group and add:

```ts
upstreamSource: {
  repository: 'microsoft/playwright-mcp',
  commit: '7d36e7c5062e9d7a6c85fbabe9318e65539ae1af',
  path: 'packages/playwright-core/src/tools/backend/find.ts',
},
```

- [ ] **Step 5: Verify GREEN**

```bash
bunx playwright test tests/browser-find.spec.ts --project=chromium
bun run build:publish
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tools/find.ts src/tools.ts tests/browser-find.spec.ts
git commit -m "feat: add accessibility snapshot search"
```

---

### Task 6: Add catalog control and separated dispatch gateways

**Files:**
- Create: `src/tools/catalog/gateways.ts`
- Modify: `src/tools/tool.ts`
- Modify: `src/browser-server-backend.ts`
- Modify: `src/batch/batch-executor.ts`
- Test: `tests/tool-gateways.spec.ts`

**Interfaces:**
- Produces: `createCatalogTools(options): AnyTool[]`.
- Produces: tool handlers may return `void | ToolResponse`.
- Consumes: `executeTarget(name, rawArguments, expectedEffect)`.

- [ ] **Step 1: Write failing gateway tests**

Create tests covering:

```ts
await client.callTool({
  name: 'browser_query',
  arguments: { tool: 'browser_console_messages', arguments: {} },
});

await client.callTool({
  name: 'browser_execute',
  arguments: {
    tool: 'browser_click',
    arguments: { selectors: [{ role: 'button', text: 'Save' }] },
  },
});
```

Assert:

- query rejects action/destructive targets;
- execute rejects read-only targets;
- both reject unknown targets and invalid target arguments;
- both reject `browser_tools`, both gateways, and `browser_batch_execute`;
- returned content equals a direct target call without an extra `### Result` wrapper;
- batch validation rejects either gateway and recursive batch execution.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/tool-gateways.spec.ts --project=chromium
```

Expected: tool-not-found failure.

- [ ] **Step 3: Allow raw tool responses**

Change `Tool` and `TabTool` handlers in `src/tools/tool.ts`:

```ts
handle: (
  context: Context,
  params: z.output<Input>,
  response: Response,
  signal?: AbortSignal
) => Promise<void | ToolResponse>;
```

Update `defineTabTool` to return the nested handler result and pass the signal.

- [ ] **Step 4: Implement gateway factories**

Create `src/tools/catalog/gateways.ts` with:

```ts
type GatewayOptions = {
  registry: () => ToolRegistry;
  visibility: ToolVisibility;
  notifyChanged: () => Promise<void>;
  executeTarget: (
    name: string,
    args: Record<string, unknown> | undefined,
    expected: 'readOnly' | 'action'
  ) => Promise<ToolResponse>;
};
```

`browser_tools` uses a discriminated union for `search`, `enable`, `disable`, `reset`, and `status`. It is type `action`. `search` returns at most six compact records and includes `inputSchema` only when requested.

`browser_query` is type `readOnly`; `browser_execute` is type `action`. Both return the `ToolResponse` from `executeTarget` directly.

- [ ] **Step 5: Execute raw responses in the backend**

Extract a private backend method:

```ts
private async _executeTool(
  registration: ToolRegistration,
  rawArguments: Record<string, unknown> | undefined,
  signal?: AbortSignal
): Promise<mcpServer.ToolResponse> {
  const parsedArguments = registration.tool.schema.inputSchema.parse(
    rawArguments ?? {}
  );
  const response = new Response(/* existing arguments */);
  const rawResponse = await registration.tool.handle(
    context,
    parsedArguments,
    response,
    signal
  );
  if (rawResponse) return rawResponse;
  await response.finish();
  return response.serialize();
}
```

Implement gateway target checks before calling `_executeTool`.

- [ ] **Step 6: Block recursive batch dispatch**

In `BatchExecutor.validateAllSteps`, reject this set before normal lookup:

```ts
const DISALLOWED_BATCH_TARGETS = new Set([
  'browser_batch_execute',
  'browser_tools',
  'browser_query',
  'browser_execute',
]);
```

Return `Tool cannot be nested in batch execution: <name>`.

- [ ] **Step 7: Verify GREEN**

```bash
bunx playwright test tests/tool-gateways.spec.ts tests/batch-execute.spec.ts --project=chromium
bun run build:publish
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/tools/catalog/gateways.ts src/tools/tool.ts src/browser-server-backend.ts src/batch/batch-executor.ts tests/tool-gateways.spec.ts
git commit -m "feat: add schema-validated tool gateways"
```

---

### Task 7: Integrate visible lists, hidden direct calls, and list-change notifications

**Files:**
- Modify: `src/mcp/server.ts`
- Modify: `src/browser-server-backend.ts`
- Modify: `src/tools.ts`
- Modify: `tests/fixtures.ts`
- Test: `tests/tool-visibility.spec.ts`
- Test: `tests/tool-gateways.spec.ts`

**Interfaces:**
- Produces: `ServerBackend.resolveTool(name)` for complete-registry lookup.
- Produces: `BrowserServerBackend.tools()` as visible schemas only.
- Produces: tool-list changed notifications after successful state changes.

- [ ] **Step 1: Add failing integration tests**

Add tests that:

1. call `client.listTools()` on adaptive startup and assert the exact seven sorted names;
2. call a hidden known tool directly and assert it succeeds;
3. enable `browser_console_messages`, wait for `notifications/tools/list_changed`, then assert it appears in `listTools()`;
4. reset and assert the startup list returns;
5. start two clients, enable a tool in one, and assert the other remains unchanged;
6. start with `{ toolProfile: 'full' }` and assert every capability-filtered tool is listed;
7. start with `{ toolProfile: 'minimal' }` and assert exactly three names.

Use the SDK notification schema in the test client:

```ts
client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
  notification.resolve();
});
```

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/tool-visibility.spec.ts tests/tool-gateways.spec.ts --project=chromium
```

Expected: current static list or hidden tool-not-found failures.

- [ ] **Step 3: Separate list and call lookup in the server**

Change `ServerBackend`:

```ts
tools(): ToolSchema[];
resolveTool(name: string): ToolSchema | undefined;
callTool(
  schema: ToolSchema,
  rawArguments: Record<string, unknown> | undefined,
  signal?: AbortSignal
): Promise<ToolResponse>;
```

The list handler still calls `backend.tools()`. The call handler must call `backend.resolveTool(request.params.name)` instead of searching the visible list, and pass the request signal when the SDK supplies it.

Advertise:

```ts
capabilities: {
  tools: backend.supportsToolListChanges ? { listChanged: true } : {},
},
```

- [ ] **Step 4: Build the backend registry and session visibility**

In `BrowserServerBackend`:

- construct base registrations;
- construct catalog gateway tools with lazy registry access;
- create the final immutable registry;
- create one `ToolVisibility(config.toolProfile)`;
- have `tools()` return visible schemas;
- have `resolveTool()` return any registered schema;
- keep `Context.tools` as all registered tools so direct calls and batch lookup remain compatible.

Store the initialized server only for notifications:

```ts
private _server: mcpServer.Server | undefined;

private async _notifyToolsChanged(): Promise<void> {
  try {
    await this._server?.sendToolListChanged();
  } catch (error) {
    browserServerBackendDebug('Failed to notify tool list change:', error);
  }
}
```

- [ ] **Step 5: Update fixtures**

Extend `startClient` options with `toolProfile?: ToolProfile`. Convert it to `--tool-profile=<value>` unless an explicit config already sets `toolProfile`.

- [ ] **Step 6: Verify GREEN**

```bash
bunx playwright test tests/tool-visibility.spec.ts tests/tool-gateways.spec.ts tests/batch-execute.spec.ts --project=chromium
bun run build:publish
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/mcp/server.ts src/browser-server-backend.ts src/tools.ts tests/fixtures.ts tests/tool-visibility.spec.ts tests/tool-gateways.spec.ts
git commit -m "feat: expose a session-adaptive tool catalog"
```

---

### Task 8: Enforce context budgets and schema caching

**Files:**
- Create: `benchmark/tool-catalog.ts`
- Create: `benchmark/tool-catalog-baseline.json`
- Create: `tests/tool-context-budget.spec.ts`
- Modify: `src/mcp/tool.ts`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: cached `toMcpTool` results by `ToolSchema` identity.
- Produces: `bun run benchmark:tools [-- --check|--write-baseline]`.

- [ ] **Step 1: Write failing budget tests**

Create `tests/tool-context-budget.spec.ts`:

```ts
test('adaptive tools/list remains within the context budget', () => {
  const report = measureToolCatalogs();
  expect(report.adaptive.toolCount).toBe(7);
  expect(report.adaptive.bytes).toBeLessThanOrEqual(12_000);
  expect(report.adaptive.bytes).toBeLessThanOrEqual(report.full.bytes * 0.25);
  expect(report.adaptive.maxDescriptionLength).toBeLessThanOrEqual(180);
});
```

Also assert no compact input schema contains a nested `description` or root `$schema` key.

- [ ] **Step 2: Verify RED**

```bash
bunx playwright test tests/tool-context-budget.spec.ts --project=chromium
```

Expected: missing benchmark module.

- [ ] **Step 3: Cache compact schemas**

In `src/mcp/tool.ts`, add:

```ts
const mcpToolCache = new WeakMap<object, Tool>();

export function toMcpTool<T extends z.Schema>(tool: ToolSchema<T>): Tool {
  const cached = mcpToolCache.get(tool);
  if (cached) return cached;
  const result = Object.freeze({ /* existing conversion */ });
  mcpToolCache.set(tool, result);
  return result;
}
```

Use the schema object itself as the cache key and never mutate cached values.

- [ ] **Step 4: Implement the reporter**

`benchmark/tool-catalog.ts` must export `measureToolCatalogs()` and print JSON plus a readable table. Byte size is:

```ts
Buffer.byteLength(JSON.stringify({ tools: tools.map(toMcpTool) }), 'utf8')
```

Estimated tokens are:

```ts
Math.ceil(bytes / 4)
```

`--check` enforces the hard adaptive limits and rejects full-profile growth above 10% of the baseline. `--write-baseline` writes the current full bytes and commit timestamp to `benchmark/tool-catalog-baseline.json`.

- [ ] **Step 5: Add scripts and generate the baseline**

Add:

```json
"benchmark:tools": "bun benchmark/tool-catalog.ts"
```

Run:

```bash
bun run benchmark:tools -- --write-baseline
bun run benchmark:tools -- --check
```

Expected: baseline file is created and the check passes.

- [ ] **Step 6: Add CI enforcement**

After lint/build in `.github/workflows/ci.yml`, add:

```yaml
- name: Check MCP tool context budget
  run: bun run benchmark:tools -- --check
```

- [ ] **Step 7: Verify GREEN**

```bash
bunx playwright test tests/tool-context-budget.spec.ts tests/mcp-tool-schema.spec.ts --project=chromium
bun run benchmark:tools -- --check
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add benchmark/tool-catalog.ts benchmark/tool-catalog-baseline.json tests/tool-context-budget.spec.ts src/mcp/tool.ts package.json .github/workflows/ci.yml
git commit -m "test: enforce MCP tool context budgets"
```

---

### Task 9: Document migration and run full validation

**Files:**
- Modify: `README.md`
- Modify: `package.json`
- Modify: `utils/update-readme.js` if generated option output requires it
- Test: all suites

**Interfaces:**
- Publishes: version `0.2.0` behavior and migration instructions.

- [ ] **Step 1: Add migration documentation**

Document:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@tontoko/fast-playwright-mcp@latest",
        "--tool-profile=adaptive"
      ]
    }
  }
}
```

Include:

- adaptive is the `0.2.0` default;
- `--tool-profile=full` restores the old static list;
- `browser_tools` search/enable examples;
- `browser_query` for read-only tools;
- `browser_execute` for action/destructive tools;
- hidden direct calls remain compatible;
- context-budget benchmark command.

- [ ] **Step 2: Bump the package version**

Change `package.json` version from `0.1.3` to `0.2.0`. Do not publish from this task.

- [ ] **Step 3: Regenerate documentation**

```bash
bun run update-readme
bun run lint-fix
```

Review the diff and ensure no generated section lists hidden full-profile tools as adaptive startup tools.

- [ ] **Step 4: Run full validation**

```bash
bun run build:publish
bun run lint
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

Expected: all commands pass without warnings introduced by this change.

- [ ] **Step 5: Commit**

```bash
git add README.md package.json utils/update-readme.js
git commit -m "docs: document adaptive tool discovery"
```

- [ ] **Step 6: Open the pull request**

Suggested title:

```text
feat: add adaptive tool discovery and context budgets
```

The body must include measured adaptive/full bytes, the migration command for `full`, test results, and `Fixes #17`.
