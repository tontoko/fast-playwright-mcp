# Upstream compatibility

The reviewed upstream state is defined in `upstream.json`.

- Standalone Microsoft Playwright MCP reviewed commit: `55679f5f3d4b4f3e2534ec0ce2fc5683ba2eaf3f`
- Microsoft Playwright reviewed commit: `15b1aec478d90f0293dae7b7b6dafd494d9f0154`
- Pinned Playwright canary: `1.63.0-alpha-2026-08-01`

| Feature | Status | Local implementation | Reviewed upstream source | Notes |
|---|---|---|---|---|
| Playwright runtime version | Ported | `package.json`, `bun.lock` | `microsoft/playwright@15b1aec478d90f0293dae7b7b6dafd494d9f0154` | Playwright packages are pinned together to the exact tested `next` build; Node.js 20 is required. |
| Standalone Playwright MCP delta | Reviewed | `index.d.ts`, `upstream.json` | `microsoft/playwright-mcp@55679f5f3d4b4f3e2534ec0ce2fc5683ba2eaf3f` | Removed the declaration shebang and retained the locally correct programmatic API; the other upstream change was documentation/devcontainer-only. |
| Accessibility snapshot search | Ported | `src/tools/find.ts` | Microsoft MCP backend | Adapted to local response expectations and result limits. |
| Partial accessibility snapshots | Ported | `src/tab.ts` | Microsoft MCP snapshot handling | CSS selectors scope the locator snapshot; missing selectors fall back to the full snapshot. |
| Dialog lifecycle cleanup | Ported | `src/tab.ts` | `microsoft/playwright@887b421089a18e60107397c8c037a4ea1f9d5925` | Side-channel dialog closure clears stale modal state. |
| Explicit download detection | Ported | `src/tab.ts` | `microsoft/playwright@15c4f55879e49159e766fe1aa3dd9f9d87ba5fc1` | Generic Chromium `ERR_ABORTED` errors are no longer treated as downloads. |
| Generated-code escaping | Ported | `src/utils/codegen.ts`, `src/utils/common-formatters.ts` | `microsoft/playwright@e0e867011c1e29682b5dcc1380aa3dd6380b7858` | URLs, keys, text, backslashes, and line breaks generate valid JavaScript strings. |
| Missing-browser diagnostics | Ported | `src/browser-context-factory.ts` | `microsoft/playwright@610977b294d916c8936953d28f9cfcb8c37d22a8` | The expected executable path is preserved. |
| Configurable post-action settle delay | Ported | `src/config.ts`, `src/program.ts`, `src/tools/utils.ts` | `microsoft/playwright@6d487d67c9cfaa960faa32f60a8e0a03facd3d91` | CLI, environment, and config support `timeouts.settle`; default is 500 ms. |
| Extension profile selection | Ported | `src/extension/profile.ts`, `src/extension/cdp-relay.ts` | `microsoft/playwright@0edafe4baab7fd20122939d3cfe1acabd8ed84a9` | Prefers the last-used profile containing the configured extension. |
| Extension rejection and retry | Ported | `extension/src/background.ts`, `extension/src/ui/connect.tsx` | Local regression plus upstream lazy-connection intent | Reject closes pending sockets, timers, and stale ownership safely. |
| Extension protocol v2 | Deferred | `extension/README.md`, `src/extension/connect-url.ts` | `microsoft/playwright@f7342d2099363e0bf5b49d00cf4b3362e3421371` | The bundled protocol-v1 extension remains supported; the current Web Store extension is not claimed compatible. |
| Skip discarded ARIA snapshots | Already covered | `src/response.ts` | `microsoft/playwright@15b1aec478d90f0293dae7b7b6dafd494d9f0154` | Local response expectations avoid snapshot capture when the response does not request one. |
| CDP headers and timeout | Ported | `src/config.ts`, `src/browser-context-factory.ts` | Microsoft MCP configuration | CLI, environment, and config inputs converge on one validated representation. |
| Configurable MCP heartbeat | Ported | `src/mcp/server.ts` | Microsoft MCP server utilities | Zero disables the heartbeat; backend initialization cannot leave tool calls pending forever. |
| HTTP Host validation | Ported | `src/http-server.ts`, `src/mcp/transport.ts` | Microsoft MCP HTTP transport | Applied before MCP request parsing, including IPv6 loopback normalization. |
| Action, navigation, expectation, and settle timeouts | Ported | `src/config.ts`, `src/tab.ts`, `src/tools/wait.ts`, `src/tools/utils.ts` | Microsoft MCP configuration | Local expectation controls remain supported. |
| Test-id attribute | Ported | `src/config.ts`, browser-context setup | Microsoft MCP configuration | Conflicting concurrent values are rejected. |
| Screenshot scale | Ported | `src/tools/screenshot.ts` | Microsoft screenshot behavior | Supports `css` and `device`. |
| Generated-code suppression | Ported | `src/response.ts` | Microsoft MCP configuration | `codegen: "none"` suppresses code sections. |
| Output size limit | Local hardening | `src/output-manager.ts` | Local implementation | Includes canonical-path, symlink, active-target, and queue-failure protections. |
| Secret redaction | Local hardening | `src/utils/secret-redactor.ts`, `src/session-log.ts`, `src/response.ts` | Local implementation | Applies to responses, session Markdown, generated code, arguments, and snapshot files. |
| Adaptive tool discovery | Local feature | `src/tools/catalog/*` | Local implementation | Full profile preserves static compatibility. |
| Offline MCP Apps dashboard | Local implementation | `src/apps/dashboard/*` | MCP Apps SDK contract | No runtime CDN or external request dependency. |
| Upstream formatting and release automation | Rejected | — | Microsoft repository configuration | Local Ultracite/Biome and release policy are retained. |
