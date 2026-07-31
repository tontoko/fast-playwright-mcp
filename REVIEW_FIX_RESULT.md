# PR 31 review-fix verification

- result: FAIL
- source commit: 3c31555f779e7053fcafe32f116bc6ca3f43d6c0

## Test output tail

```text

Running 17 tests using 1 worker

  ✓   1 [chromium] › tests/http-allowed-hosts.spec.ts:4:1 › normalizes valid Host headers and strips ports and IPv6 brackets (10ms)
  ✓   2 [chromium] › tests/http-allowed-hosts.spec.ts:10:1 › rejects malformed and credential-bearing Host headers (10ms)
  ✓   3 [chromium] › tests/http-allowed-hosts.spec.ts:16:1 › allows IPv4 and IPv6 loopback defaults and configured hosts (11ms)
  ✓   4 [chromium] › tests/output-manager.spec.ts:6:1 › evicts oldest completed files while preserving the finalized target (81ms)
  ✓   5 [chromium] › tests/output-manager.spec.ts:22:1 › does not follow file symlinks and rejects lexical path traversal (61ms)
  ✓   6 [chromium] › tests/output-manager.spec.ts:38:1 › rejects a symlinked parent that escapes the output directory (47ms)
  ✓   7 [chromium] › tests/output-manager.spec.ts:55:1 › rejects finalization targets outside the output directory (49ms)
  ✓   8 [chromium] › tests/upstream-config.spec.ts:12:1 › resolves upstream-compatible configuration fields (6ms)
  ✓   9 [chromium] › tests/upstream-config.spec.ts:39:1 › CLI and environment parsing preserve headers and timeouts (4ms)
  ✘  10 [chromium] › tests/upstream-config.spec.ts:69:1 › rejects invalid CDP header names and line breaks (2ms)
  ✓  11 [chromium] › tests/upstream-config.spec.ts:76:1 › Commander-shaped CDP header option reaches the browser config (8ms)
  ✓  12 [chromium] › tests/upstream-config.spec.ts:90:1 › Commander-shaped secrets option parses dotenv values for redaction (9ms)
  ✓  13 [chromium] › tests/upstream-config.spec.ts:106:1 › PLAYWRIGHT_MCP_SECRETS loads the same dotenv redaction values (4ms)
  ✓  14 [chromium] › tests/upstream-config.spec.ts:118:1 › PLAYWRIGHT_MCP_CONFIG loads a configuration file before environment overrides (3ms)
  ✓  15 [chromium] › tests/upstream-config.spec.ts:145:1 › keeps Chromium-only launch flags out of Firefox and WebKit (4ms)
  ✓  16 [chromium] › tests/upstream-config.spec.ts:163:1 › numeric and heartbeat parsers reject or default invalid values (10ms)
  ✘  17 [chromium] › tests/partial-snapshot-css.spec.ts:4:1 › snapshotOptions.selector scopes the snapshot with a CSS selector (58ms)


  1) [chromium] › tests/partial-snapshot-css.spec.ts:4:1 › snapshotOptions.selector scopes the snapshot with a CSS selector 

    McpError: MCP error -32000: Connection closed
        at Function.fromError (/home/runner/work/fast-playwright-mcp/fast-playwright-mcp/node_modules/@modelcontextprotocol/sdk/src/types.ts:2316:16)
        at Client._onclose (/home/runner/work/fast-playwright-mcp/fast-playwright-mcp/node_modules/@modelcontextprotocol/sdk/src/shared/protocol.ts:645:32)
        at StdioClientTransport._transport.onclose (/home/runner/work/fast-playwright-mcp/fast-playwright-mcp/node_modules/@modelcontextprotocol/sdk/src/shared/protocol.ts:612:18)
        at ChildProcess.<anonymous> (/home/runner/work/fast-playwright-mcp/fast-playwright-mcp/node_modules/@modelcontextprotocol/sdk/src/client/stdio.ts:143:31)

    Error Context: test-results/partial-snapshot-css-snaps-4aa82-napshot-with-a-CSS-selector-chromium/error-context.md

  2) [chromium] › tests/upstream-config.spec.ts:69:1 › rejects invalid CDP header names and line breaks 

    Error: expect(received).toThrow(expected)

    Expected substring: "Invalid header"

    Received function did not throw

      68 |
      69 | test('rejects invalid CDP header names and line breaks', () => {
    > 70 |   expect(() => headerParser('Bad Header: value')).toThrow('Invalid header');
         |                                                   ^
      71 |   expect(() => headerParser('X-Test: safe\r\nInjected: value')).toThrow(
      72 |     'Invalid header'
      73 |   );
        at /home/runner/work/fast-playwright-mcp/fast-playwright-mcp/tests/upstream-config.spec.ts:70:51

    Error Context: test-results/upstream-config-rejects-in-20ac7-eader-names-and-line-breaks-chromium/error-context.md

  2 failed
    [chromium] › tests/partial-snapshot-css.spec.ts:4:1 › snapshotOptions.selector scopes the snapshot with a CSS selector 
    [chromium] › tests/upstream-config.spec.ts:69:1 › rejects invalid CDP header names and line breaks 
  15 passed (3.9s)

```
