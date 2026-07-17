# Migrating to 0.2

Version 0.2 changes the default MCP tool catalog from the complete static list to the `adaptive` profile. This reduces startup context while preserving access to every registered tool.

## Restore the previous static catalog

Add the following argument:

```text
--tool-profile=full
```

Equivalent configuration:

```json
{
  "toolProfile": "full"
}
```

## Adaptive discovery

The default startup catalog contains seven tools:

- `browser_tools`
- `browser_query`
- `browser_execute`
- `browser_batch_execute`
- `browser_navigate`
- `browser_snapshot`
- `browser_find`

Use `browser_tools` with `action: "search"` to find a tool. Enable a result when the client supports tool-list change notifications, or call it through `browser_query` or `browser_execute`. Existing integrations that call a hidden registered tool by name continue to work.

## Minimal profile

`--tool-profile=minimal` exposes only `browser_tools`, `browser_query`, and `browser_execute`. This has the smallest startup catalog and is appropriate when navigation and snapshot operations are also dispatched through gateways.

## New configuration controls

Version 0.2 adds typed CLI, environment, and configuration-file controls for:

- CDP request headers and connection timeout
- HTTP Host allowlisting
- output-directory size limits
- response secret redaction
- action, navigation, and expectation timeouts
- test-id attribute selection
- generated-code suppression with `codegen: "none"`
- screenshot CSS/device pixel scale
- opt-in MCP Apps support with `--caps=apps`

See `--help` and the main README for exact names.

## Runtime requirements

- Node.js 18 or newer
- the package's pinned Playwright browser revision, or a compatible configured executable
- Bun 1.3.5 for repository development and CI

## Intentional upstream differences

This package retains its adaptive tool catalog, expectation-based response controls, enhanced selectors, diagnostics, browser extension integration, batch execution, and Ultracite/Biome configuration. It is not a wholesale mirror of Microsoft Playwright MCP.
