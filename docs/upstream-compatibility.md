# Upstream compatibility

The reviewed upstream state is defined in `upstream.json`.

- Standalone Microsoft Playwright MCP reviewed commit: `7e0457a7cbf88823bf0146d12c46ae12c6818247`
- Microsoft Playwright reviewed commit: `8078b85865a9643b37b5564c188a252545253749`
- Reviewed standalone release: `0.0.79`
- Pinned Playwright canary: `1.63.0-alpha-2026-08-17`

The scheduled audit compares both repositories independently. Behavior is ported only when it fits this repository's adaptive catalog, response expectations, selector model, and bundled extension protocol.

| Feature | Status | Local implementation | Reviewed upstream source | Notes |
|---|---|---|---|---|
| Playwright runtime version | Ported | `package.json`, `bun.lock` | `microsoft/playwright-mcp@4ed35bf8713337dfce02f073edd3bd0c7ebf310f` | Playwright packages are pinned together to the exact v0.0.79 runtime build; Node.js 20 is required. |
| Dual upstream audit | Ported | `scripts/upstream-check.ts`, `upstream.json` | `microsoft/playwright-mcp@7e0457a7cbf88823bf0146d12c46ae12c6818247`, `microsoft/playwright@8078b85865a9643b37b5564c188a252545253749` | Reports the standalone MCP and Playwright runtime deltas separately and remains read-only. |
| Accessibility snapshot search | Ported | `src/tools/find.ts` | Microsoft MCP backend | Adapted to local response expectations and result limits. |
| Partial accessibility snapshots | Ported | `src/tab.ts` | Microsoft MCP snapshot handling | CSS selectors scope the locator snapshot; missing selectors fall back to the full snapshot. |
| Dialog lifecycle cleanup | Ported | `src/tab.ts` | `microsoft/playwright@887b421089a18e60107397c8c037a4ea1f9d5925` | Side-channel dialog closure clears stale modal state. |
| Explicit download detection | Ported | `src/tab.ts` | `microsoft/playwright@15c4f55879e49159e766fe1aa3dd9f9d87ba5fc1` | Generic Chromium `ERR_ABORTED` errors are no longer treated as downloads. |
| Generated-code escaping | Ported | `src/utils/codegen.ts`, `src/utils/common-formatters.ts` | `microsoft/playwright@e0e867011c1e29682b5dcc1380aa3dd6380b7858` | URLs, keys, text, backslashes, line breaks, backticks, and template openings generate valid JavaScript strings. |
| Missing-browser diagnostics | Ported | `src/browser-context-factory.ts`, `src/extension/cdp-relay.ts` | `microsoft/playwright@610977b294d916c8936953d28f9cfcb8c37d22a8`, `microsoft/playwright@b637a5a4098789da917a4605d1966bd3f9528d63` | The expected executable path is preserved and custom launch errors reject the tool call instead of crashing the process. |
| Configurable post-action settle delay | Ported | `src/config.ts`, `src/program.ts`, `src/tools/utils.ts` | `microsoft/playwright@6d487d67c9cfaa960faa32f60a8e0a03facd3d91` | CLI, environment, and config support `timeouts.settle`; default is 500 ms. |
| Extension profile selection | Ported | `src/extension/profile.ts`, `src/extension/cdp-relay.ts` | `microsoft/playwright@0edafe4baab7fd20122939d3cfe1acabd8ed84a9` | Prefers the last-used profile containing the configured extension, including custom executables. |
| Extension CDP defaults | Ported | `src/extension/extension-context-factory.ts` | `microsoft/playwright@539fd2c1047eeff2c7bffbf15acc736fd3b6a42a` | `noDefaults` preserves media and other existing-page state when attaching. |
| Extension relay Host and Origin validation | Ported | `src/extension/cdp-relay.ts` | `microsoft/playwright@40d39ac89ace291dc25572f2b14988e786323db5` | Loopback Host headers and extension origins are allowed; untrusted web origins and hosts are rejected before upgrade. |
| Extension rejection and retry | Ported | `extension/src/background.ts`, `extension/src/ui/connect.tsx` | Local regression plus upstream lazy-connection intent | Reject closes pending sockets, timers, and stale ownership safely. |
| Browser reconnect after disconnect | Ported | `src/extension/extension-context-factory.ts`, `src/browser-context-factory.ts` | `microsoft/playwright@2cc9f3ee7fdd82feb87edb7f24af77442bdc10e2` | Failed and disconnected browser/relay promises are cleared before retry. |
| Extension protocol v2 | Deferred | `extension/README.md`, `src/extension/connect-url.ts` | `microsoft/playwright@f7342d2099363e0bf5b49d00cf4b3362e3421371` | The bundled protocol-v1 extension remains supported; the current Web Store extension is not claimed compatible. |
| WebP screenshots | Ported | `src/tools/screenshot.ts` | `microsoft/playwright-mcp@4c5077651542f68525a0b51e97bab2a32abc9290` | Supports `png`, `jpeg`, and `webp`, with filename-extension inference when type is omitted. |
| Snapshot bounding boxes | Deferred | — | `microsoft/playwright@f8b14a311edb17eb07aabf380fed4d619bd1b8ab` | Requires a deliberate local snapshot-output contract because adaptive responses and token budgets differ. |
| Multi-language code generation | Deferred | — | `microsoft/playwright@273c8aabe741f2a022a6a1286a3125a97111b0c6` | Local generated-code output is intentionally JavaScript-compatible; adding language-specific emitters is a separate public API change. |
| Structured JSON snapshots | Deferred | — | `microsoft/playwright@ea4ea1f658cba38ead61ab6c1cf80ce519d9366d` | The MCP response contract is not the Playwright CLI JSON protocol. |
| Skip discarded ARIA snapshots | Already covered | `src/response.ts` | `microsoft/playwright@15b1aec478d90f0293dae7b7b6dafd494d9f0154` | Local response expectations avoid snapshot capture when the response does not request one. |
| CDP headers and timeout | Ported | `src/config.ts`, `src/browser-context-factory.ts` | Microsoft MCP configuration | CLI, environment, and config inputs converge on one validated representation. |
| Configurable MCP heartbeat | Ported | `src/mcp/server.ts` | Microsoft MCP server utilities | Zero disables the heartbeat; backend initialization cannot leave tool calls pending forever. |
| HTTP Host validation | Ported | `src/http-server.ts`, `src/mcp/transport.ts` | Microsoft MCP HTTP transport | Applied before MCP request parsing, including IPv6 loopback normalization. |
| Action, navigation, expectation, and settle timeouts | Ported | `src/config.ts`, `src/tab.ts`, `src/tools/wait.ts`, `src/tools/utils.ts` | Microsoft MCP configuration | Local expectation controls remain supported. |
| Test-id attribute | Ported | `src/config.ts`, browser-context setup | Microsoft MCP configuration | Conflicting concurrent values are rejected. |
| Screenshot scale | Ported | `src/tools/screenshot.ts` | Microsoft screenshot behavior | Supports `css` and `device`. |
| Generated-code suppression | Ported | `src/response.ts` | Microsoft MCP configuration | `codegen: "none"` suppresses code sections. |
| Output size limit | Local hardening | `src/output-manager.ts` | Local implementation | Includes canonical-path, symlink, active-target, active-session, and queue-failure protections. |
| Secret redaction | Local hardening | `src/utils/secret-redactor.ts`, `src/session-log.ts`, `src/response.ts` | Local implementation | Applies to responses, session Markdown, generated code, arguments, and snapshot files. |
| Adaptive tool discovery | Local feature | `src/tools/catalog/*` | Local implementation | Full profile preserves static compatibility. |
| Offline MCP Apps dashboard | Local implementation | `src/apps/dashboard/*` | MCP Apps SDK contract | No runtime CDN or external request dependency; refresh remains valid when image responses are omitted. |
| Upstream formatting and release automation | Rejected | — | Microsoft repository configuration | Local Ultracite/Biome and release policy are retained. |
