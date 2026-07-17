# Upstream compatibility

The reviewed upstream state is defined in `upstream.json`.

| Feature | Status | Local implementation | Reviewed upstream source | Notes |
|---|---|---|---|---|
| Playwright runtime version | Ported | `package.json`, `bun.lock` | `microsoft/playwright-mcp@5f8fc00210b27b4407c375b59cda4838045d429c` | Playwright packages are pinned together. |
| Accessibility snapshot search | Ported | `src/tools/find.ts` | `microsoft/playwright-mcp@7d36e7c5062e9d7a6c85fbabe9318e65539ae1af:packages/playwright-core/src/tools/backend/find.ts` | Adapted to local response expectations and result limits. |
| Public JavaScript evaluation API | Ported | `src/tools/evaluate.ts` | `microsoft/playwright:packages/playwright-core/src/tools/backend/evaluate.ts` | Removed reliance on deleted private APIs. |
| CDP headers and timeout | Ported | `src/config.ts`, `src/browser-context-factory.ts` | Reviewed against `microsoft/playwright:packages/playwright-core/src/tools/mcp/config.ts` | Exposed through CLI, environment, and config. |
| Configurable MCP heartbeat | Ported | `src/mcp/server.ts` | Reviewed against `microsoft/playwright:packages/playwright-core/src/tools/utils/mcp/server.ts` | Zero disables the heartbeat. |
| HTTP Host validation | Ported | `src/http-server.ts`, `src/mcp/transport.ts` | Reviewed against Microsoft MCP HTTP transport tests | Applied before MCP request parsing. |
| Action, navigation, and expectation timeouts | Ported | `src/config.ts`, `src/tab.ts`, `src/tools/wait.ts` | Reviewed against upstream MCP configuration | Local expectation controls remain supported. |
| Test-id attribute | Ported | `src/config.ts`, browser-context setup | Reviewed against upstream MCP configuration | Conflicting concurrent values are rejected. |
| Screenshot scale | Ported | `src/tools/screenshot.ts` | Reviewed against upstream screenshot behavior | Supports `css` and `device`. |
| Generated-code suppression | Ported | `src/response.ts` | Reviewed against upstream MCP configuration | `codegen: "none"` suppresses code sections. |
| Output size limit | Local hardening | `src/output-manager.ts` | Local implementation | Includes symlink and active-target protections. |
| Secret redaction | Local hardening | `src/utils/secret-redactor.ts`, `src/response.ts` | Local implementation | Applies to direct and gateway text responses. |
| Adaptive tool discovery | Local feature | `src/tools/catalog/*` | Local implementation | Full profile preserves static compatibility. |
| Offline MCP Apps dashboard | Local implementation | `src/apps/dashboard/*` | MCP Apps SDK contract | No runtime CDN or external request dependency. |
| Upstream formatting and release automation | Rejected | — | Microsoft repository configuration | Local Ultracite/Biome and release policy are retained. |
