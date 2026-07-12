# Context-Efficient Tool Discovery and Upstream Alignment

**Date:** 2026-07-12  
**Status:** Proposed  
**Depends on:** PR #30 (`fix/all-open-issues`)

## 1. Purpose

This design addresses three related maintenance problems:

1. The MCP tool catalog consumes too much model context even after nested schema descriptions are compacted.
2. The repository has diverged from the Microsoft Playwright MCP implementation and lacks a repeatable way to evaluate and port upstream changes.
3. PR #26 proposes an MCP Apps dashboard, but its current implementation has unresolved review concerns and should not be merged as-is.

The target is a smaller default context footprint, preserved compatibility for existing clients, a maintainable upstream relationship that does not replace the repository's formatter or lint rules, and a secure offline dashboard implementation.

## 2. Scope and sequencing

The work is intentionally split into focused, stacked pull requests rather than extending PR #30 further.

1. **Adaptive tool catalog and context budgets**
2. **Upstream compatibility tracking and selected capability ports**
3. **Offline MCP Apps dashboard replacing PR #26**
4. **Final conformance, documentation, and repository cleanup**

Each pull request must be independently testable and reviewable. The branches may initially be stacked on PR #30 and will be retargeted to `main` as predecessors merge.

## 3. Decisions

### 3.1 Default tool exposure

The default profile becomes `adaptive`. It exposes a small bootstrap catalog and makes the remaining tools discoverable and executable without permanently injecting every schema into model context.

Supported profiles:

- `adaptive` — default; bootstrap tools plus session-enabled tools
- `full` — current static behavior for compatibility and debugging
- `minimal` — only discovery and generic execution tools

Configuration is available through both CLI and config file:

```text
--tool-profile adaptive|full|minimal
```

```ts
{
  toolProfile?: 'adaptive' | 'full' | 'minimal';
}
```

### 3.2 Bootstrap catalog

The adaptive profile initially exposes no more than these seven tools:

1. `browser_tools` — search, enable, disable, reset, and inspect the tool catalog
2. `browser_execute` — schema-validated fallback execution for a hidden tool
3. `browser_batch_execute` — compact multi-step execution
4. `browser_navigate` — establish or change page location
5. `browser_snapshot` — inspect current page state
6. `browser_find` — search the accessibility snapshot without returning the full tree
7. `browser_close` — release browser resources

The exact list is covered by a snapshot test and cannot grow without an explicit context-budget update.

### 3.3 Dynamic discovery and activation

`browser_tools` has a compact, deterministic API:

```ts
type BrowserToolsRequest =
  | { action: 'search'; query: string; limit?: number; includeSchema?: boolean }
  | { action: 'enable'; tools?: string[]; groups?: ToolGroup[] }
  | { action: 'disable'; tools?: string[]; groups?: ToolGroup[] }
  | { action: 'reset' }
  | { action: 'status' };
```

Search uses local metadata only: tool names, aliases, groups, keywords, titles, and concise summaries. It does not use an external service or embedding model. Results are capped at six tools by default.

Enabling or disabling tools updates session-local state and sends `notifications/tools/list_changed` when the connected client supports it. A client that ignores or does not support dynamic list changes can still call the returned tool through `browser_execute`.

`browser_execute` validates the target name against the internal registry and validates arguments with the target tool's own Zod schema. It cannot execute arbitrary functions, modules, commands, or unregistered names. The tool is annotated as destructive because it may dispatch to action tools.

Existing clients that already know a hidden tool name may continue calling it directly. Visibility in `tools/list` and callability are intentionally separate so the adaptive profile does not break cached integrations.

### 3.4 Tool registry

Tool registration is centralized instead of being assembled as an unstructured array.

```ts
type ToolGroup =
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

interface RegisteredTool {
  tool: AnyTool;
  group: ToolGroup;
  aliases: readonly string[];
  keywords: readonly string[];
  bootstrap?: boolean;
  upstreamSource?: {
    repository: string;
    commit: string;
    path: string;
  };
}
```

The registry provides:

- stable lookup by tool name
- group and profile filtering
- cached compact MCP schemas
- discovery metadata
- source attribution for upstream-derived behavior
- one place to enforce duplicate-name and annotation checks

All enabled-tool state belongs to the backend/session instance. No mutable global catalog state is permitted.

## 4. Context budgets

Tool-list size becomes a tested compatibility contract.

### 4.1 Required budgets

The serialized adaptive `tools/list` response must satisfy all of the following:

- no more than eight listed tools
- no more than 12,000 UTF-8 bytes
- no more than 25% of the full-profile serialized byte size
- no nested schema `description` or root `$schema` annotations
- top-level tool descriptions no longer than 180 characters

The byte budget is the hard CI gate. An estimated token count is also reported for maintainers, but is not the only gate because tokenizers differ between clients.

### 4.2 Benchmark output

A deterministic `bun run benchmark:tools` command prints:

- tool count by profile
- serialized bytes by profile
- estimated tokens by profile
- largest individual tool schemas
- change from the committed baseline

CI fails when the adaptive budget is exceeded. Full-profile growth above 10% requires updating the baseline with an explanation in the pull request.

### 4.3 Caching

Compact schemas are generated once per registered tool and cached. The complete visible list is cached by a stable key derived from profile and enabled tool names. Cache entries are immutable and session state only stores tool-name sets.

## 5. Upstream relationship

### 5.1 Source of truth

The repository remains an independent package with its existing Ultracite/Biome conventions. It does not merge upstream formatting, lint configuration, generated README formatting, or package scripts wholesale.

A new `upstream.json` records the reviewed upstream point:

```json
{
  "repository": "microsoft/playwright-mcp",
  "playwrightRepository": "microsoft/playwright",
  "reviewedCommit": "5f8fc00210b27b4407c375b59cda4838045d429c",
  "packageVersion": "0.0.78",
  "playwrightVersion": "1.62.0-alpha-1783623505000"
}
```

The exact values are updated only after conformance tests pass.

### 5.2 Import policy

Upstream changes are ported by behavior, not by unreviewed bulk merge.

Every port must include:

- upstream repository, commit, and source path in registry metadata or a source comment
- a local regression or conformance test
- adaptation to local types, response handling, expectation controls, and lint rules
- security review when the change affects networking, file access, secrets, browser connection, or executable launch
- documentation of intentionally omitted upstream behavior

The following are never imported automatically:

- formatter and linter configuration
- generated documentation output
- release automation
- unrelated dependency bumps
- code whose behavior duplicates or weakens a local feature

### 5.3 Automated audit

A pinned-action weekly workflow runs `bun run upstream:check`. It compares the recorded commit with upstream and creates or updates one tracking issue containing:

- changed MCP-relevant files
- release notes and feature summaries
- security-sensitive changes
- dependency-version changes
- proposed classification: port, already covered, defer, or reject

The workflow never modifies production code and never opens an automatic merge pull request. It produces an evidence report for a maintainer-reviewed port.

### 5.4 Initial upstream ports

The first alignment pass targets high-value behavior that improves context use, security, or interoperability:

1. `browser_find` accessibility-snapshot search
2. screenshot `scale` option
3. configurable heartbeat timeout
4. CDP headers and connection timeout
5. HTTP allowed-host protection
6. output directory size limits
7. secret redaction in tool responses
8. configurable action, navigation, and expectation timeouts
9. configurable test-id attribute
10. `codegen: 'none'`

Additional upstream groups—cookies, web storage, routing, tracing, video, testing assertions, and devtools—are added only behind non-bootstrap groups and only when their conformance tests pass.

## 6. MCP Apps dashboard

PR #26 is replaced rather than merged.

The replacement dashboard has these requirements:

- opt-in `apps` capability
- resources advertised only when both list and read handlers exist
- no external CDN, remote JavaScript, or runtime network dependency
- bundled client bridge and assets
- strict Content Security Policy
- no dynamic HTML interpolation of page titles, URLs, or tool results
- user-controlled refresh; no unbounded polling
- read-only initial scope: screenshot preview, tab list, connection state, and explicit tab selection
- clear user-visible errors
- unit tests for resource contracts and XSS-sensitive rendering
- offline end-to-end test that fails on any external request

The implementation credits PR #26's original intent. PR #26 is closed only after the replacement is available and verified.

## 7. Issue and pull-request closure

- PR #30 remains the bug-fix and CI baseline and is not expanded with the architecture work in this document.
- Issues #5, #6, #27, and #29 close when PR #30 merges.
- Issue #17 closes only after the adaptive profile meets the context budgets in this document.
- PR #26 remains open until the offline dashboard replacement is ready, then receives a superseding comment and is closed.
- Any stale review thread on superseded code is answered with the replacement location before resolution.

No pull-request title or description uses promotional or exaggerated language. Titles describe the concrete engineering change.

## 8. Security and failure handling

### 8.1 Generic dispatch

- registry allowlist only
- target schema validation before execution
- target annotations preserved in discovery results
- no dispatch to `browser_execute` or `browser_batch_execute` recursively
- maximum nested batch depth of one
- AbortSignal propagated to the target handler
- errors identify the target tool without echoing secrets

### 8.2 Dynamic tool lists

- enabled names are session-local
- unknown names fail without modifying state
- list-change notification failure is logged but does not corrupt state
- fallback execution remains available
- reset is idempotent

### 8.3 Upstream ports

Networking and file-system ports require negative tests. New executable or endpoint inputs are rejected unless they pass existing path, host, origin, and protocol checks.

### 8.4 Dashboard

The dashboard contains no remote code and no untrusted HTML sinks. Tool responses are rendered through DOM nodes and `textContent`. Screenshot data is accepted only from MCP image content with an image MIME type.

## 9. Testing strategy

Implementation follows test-first development.

### 9.1 Tool catalog tests

- bootstrap list exact contents
- adaptive, minimal, and full profiles
- search ranking and result limits
- enable, disable, and reset behavior
- list-changed notification behavior
- client-without-notification fallback
- hidden direct-call compatibility
- generic-dispatch allowlist and schema validation
- destructive annotations
- no cross-session state leakage

### 9.2 Context tests

- serialized byte budgets
- compact-schema preservation of defaults, enums, constants, and property names
- full-profile compatibility snapshot
- benchmark output stability

### 9.3 Upstream conformance tests

Each port has tests based on the upstream behavior and source commit. Browser behavior runs across Chrome, Chromium, Edge, Firefox, and WebKit where applicable. Chromium-only behavior is explicitly marked and separately tested.

### 9.4 Dashboard tests

- resources are advertised only with complete handlers
- unknown resource error
- no external request during build or runtime
- CSP presence
- malicious title and URL render as text
- screenshot and tab error states
- extension and standard browser modes

### 9.5 Final validation

Every pull request runs:

- package build
- lint and generated-file cleanliness
- focused unit and integration tests
- complete browser matrix
- extension build and E2E
- Docker build and smoke test
- SonarQube quality gate
- context-budget benchmark
- unresolved review-thread check before ready-for-review

## 10. Pull-request plan

### PR A — Adaptive tool discovery

Suggested title: `feat: add adaptive tool discovery and context budgets`

Includes the registry, profiles, `browser_tools`, `browser_execute`, `browser_find`, dynamic list changes, compatibility behavior, and context budgets. Closes #17.

### PR B — Upstream compatibility tracking

Suggested title: `chore: add upstream compatibility tracking`

Includes `upstream.json`, audit scripts, weekly report workflow, source-attribution conventions, and the compatibility matrix.

### PR C — Selected upstream capabilities

Suggested title: `feat: port selected upstream MCP capabilities`

Ports the initial feature list in small commits, each with conformance tests. Does not change the linter or formatter.

### PR D — Offline MCP Apps dashboard

Suggested title: `feat: add offline MCP Apps dashboard`

Reimplements and supersedes PR #26, then closes PR #26 with attribution.

### PR E — Conformance and documentation

Suggested title: `test: complete MCP conformance and migration coverage`

Adds final compatibility tests, migration guidance, benchmark documentation, and any cleanup discovered by the complete self-review.

## 11. Acceptance criteria

The program is complete when all of the following are true:

1. PR #30 and the follow-up pull requests are merged or ready for review with all checks passing.
2. No repository issue remains open because of a reproducible defect covered by this scope.
3. Issue #17's default `tools/list` is within the adaptive budgets.
4. Existing clients can restore current behavior with `toolProfile: 'full'`.
5. Hidden tools remain directly callable and are schema validated.
6. The upstream audit identifies changes after the pinned commit without importing them automatically.
7. Every selected upstream capability has source attribution and conformance tests.
8. The dashboard works offline and has no unresolved security review findings.
9. PR #26 is closed with a link to the replacement.
10. SonarQube reports a passing quality gate with no new unresolved issue introduced by the work.
11. No unresolved review thread remains on a pull request marked ready for review.

## 12. Alternatives rejected

### Keep the full catalog as the default

This preserves static behavior but does not resolve the primary context-cost complaint because tool count remains the dominant fixed cost.

### Replace all tools with one unrestricted generic executor

This minimizes the tool list but removes useful schemas and annotations, weakens model guidance, and creates a larger security and validation surface.

### Rebase wholesale onto upstream

The repository has significant custom response handling, selector, batch, diagnostic, extension, build, and lint behavior. A wholesale rebase would mix behavioral updates with formatting and architecture churn, making regressions difficult to isolate.

### Ignore upstream and update dependencies only

Dependency updates alone do not bring upstream MCP behavior, security hardening, or protocol improvements and would allow the divergence to grow without visibility.
