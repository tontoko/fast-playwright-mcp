# Context-Efficient Upstream Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute the approved design as five independently reviewable pull requests that reduce default tool context, establish upstream tracking, port selected upstream behavior, replace PR #26 securely, and finish with repository-wide conformance evidence.

**Architecture:** PR #30 remains the stable bug-fix base. Follow-up branches are stacked in order during development, with each plan producing an independently green pull request. Shared MCP types are centralized, accessibility search does not consume response artifacts, and output-size enforcement is finalized after every file write.

**Tech Stack:** TypeScript, Bun, Zod, Playwright Test, MCP SDK, GitHub Actions, SonarQube Cloud, Ultracite/Biome.

## Global Constraints

- Execute plans in the order listed below.
- Use a separate git worktree and branch for each pull request.
- Use test-first development for every behavior change.
- Review every task after its focused tests and before moving to the next task.
- Do not merge any pull request without explicit maintainer authorization.
- Do not use exaggerated or promotional language in repository artifacts.
- Do not replace the local formatter or linter with upstream configuration.
- All GitHub Action references remain pinned to full commit SHAs.

---

## Authoritative Execution Order

1. `2026-07-12-adaptive-tool-discovery.md`
2. `2026-07-12-upstream-compatibility-tracking.md`
3. `2026-07-12-selected-upstream-capabilities.md`
4. `2026-07-12-offline-mcp-apps-dashboard.md`
5. `2026-07-12-conformance-and-release-readiness.md`

PR branches and bases:

| PR | Branch | Initial base |
|---|---|---|
| Adaptive discovery | `agent/adaptive-tool-discovery` | `fix/all-open-issues` |
| Upstream tracking | `agent/upstream-compatibility-tracking` | adaptive discovery head |
| Selected ports | `agent/selected-upstream-capabilities` | upstream tracking head |
| Offline dashboard | `agent/offline-mcp-apps-dashboard` | selected ports head |
| Conformance | `agent/mcp-conformance-coverage` | offline dashboard head |

After a predecessor merges, rebase or retarget the next PR to `main` and rerun the complete validation for that PR.

## Plan Review Amendments

These details are authoritative where a sub-plan uses a less-specific current-code shortcut.

### Shared MCP types

Create `src/mcp/types.ts` during Adaptive Task 1 and define:

```ts
import type { ImageContent, TextContent } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';

export type ToolEffect = 'readOnly' | 'action' | 'destructive';

export type ToolResponse = {
  content: (TextContent | ImageContent)[];
  isError?: boolean;
};

export type ToolSchema<Input extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string;
  title: string;
  description: string;
  inputSchema: Input;
  type: ToolEffect;
};
```

`src/mcp/tool.ts`, `src/mcp/server.ts`, and `src/tools/tool.ts` import these types. Remove the duplicate `ToolSchema` and `ToolResponse` declarations from `src/mcp/server.ts`. Type-only imports prevent runtime cycles.

### Non-consuming snapshot search

`browser_find` must not call `Tab.captureSnapshot()` because that method consumes recent console-message state. Add this method to `Tab` with a focused test:

```ts
async captureAriaSnapshot(): Promise<string> {
  let snapshot = '';
  await this._raceAgainstModalStates(async () => {
    snapshot = (await (this.page as PageEx)._snapshotForAI()).full;
  });
  return snapshot;
}
```

`browser_find` searches `await tab.captureAriaSnapshot()`. The test first emits a console message, calls `browser_find`, then calls `browser_snapshot` and proves the console message is still present.

### Output-size finalization

`OutputManager` exposes both reservation and finalization:

```ts
reserveFile(name: string): Promise<string>;
finalizeFile(path: string): Promise<void>;
```

`finalizeFile` serializes eviction after the writer has closed the target and never deletes the target being finalized. Update all repository-managed output writers in the same task:

- screenshot after `page.screenshot` or `locator.screenshot`;
- download after `download.saveAs`;
- session-log writes after file flush;
- trace output after tracing stops;
- PDF and any explicit file-write tools after write completion.

The output-manager test must assert the directory is within the configured limit immediately after `finalizeFile`, not only before the next reservation.

### Dependency upgrade failure handling

The selected-capabilities dependency task does not guess at compatibility fixes. If the isolated Playwright upgrade fails:

1. capture the complete error and failing test;
2. invoke systematic debugging;
3. add a minimal failing regression test for the changed upstream contract;
4. implement only that compatibility fix in a separate commit immediately after the dependency commit;
5. rerun the complete focused suite before continuing.

### Catalog metadata completeness

Registry creation fails if a registered tool has no group or has a top-level description longer than 180 characters. Search aliases and extra keywords are optional, but groups are not. The registry test iterates the complete configured registry and proves every registration passes validation.

## Self-Review Results

- **Spec coverage:** Every design section maps to one of the five plans. Context budgets and Issue #17 are in the adaptive plan; upstream tracking and source attribution are in the tracking plan; selected ports are in the capability plan; PR #26 replacement is in the dashboard plan; closure, package testing, and review gates are in the conformance plan.
- **Placeholder scan:** The plans contain no `TBD`, `TODO`, deferred implementation stubs, or unspecified “add tests” steps. Contingent dependency failures are routed to a defined debugging/test-first process above.
- **Type consistency:** `ToolEffect`, `ToolResponse`, and `ToolSchema` are centralized in `src/mcp/types.ts`. Profile names, bootstrap names, resource URI, gateway names, upstream manifest fields, and CLI/environment names are consistent across plans.
- **Boundary check:** Mutable tool visibility belongs to a backend/session; registry/schema caches are immutable; upstream automation cannot modify code; dashboard resources are opt-in and offline; output cleanup happens after writes.

## Completion Checkpoints

- [ ] PR #30 is merged or remains the explicitly approved base with all checks passing.
- [ ] Adaptive discovery PR meets the context budget and closes #17.
- [ ] Upstream tracking PR produces a fixture-stable report and weekly issue workflow.
- [ ] Selected capability PR passes all security-negative and browser-matrix tests.
- [ ] Offline dashboard PR has no external requests and supersedes PR #26.
- [ ] Conformance PR passes package-install smoke, review-thread gate, SonarQube, Docker, extension, and all browser projects.
- [ ] Issues #5, #6, #17, #27, and #29 have evidence-backed closure.
- [ ] No non-draft PR has an unresolved review thread.
