# PR 31 review-fix verification

- result: FAIL
- source commit: 3dfb8b5006c684b11dc83d4baaa94193ce5a51bf

## Test output tail

```text

Running 11 tests using 1 worker

  ✘   1 [chromium] › tests/http-allowed-hosts.spec.ts:4:1 › normalizes valid Host headers and strips ports and IPv6 brackets (13ms)
  ✓   2 [chromium] › tests/http-allowed-hosts.spec.ts:10:1 › rejects malformed and credential-bearing Host headers (11ms)
  ✘   3 [chromium] › tests/http-allowed-hosts.spec.ts:16:1 › allows IPv4 and IPv6 loopback defaults and configured hosts (9ms)
  ✓   4 [chromium] › tests/upstream-config.spec.ts:12:1 › resolves upstream-compatible configuration fields (8ms)
  ✓   5 [chromium] › tests/upstream-config.spec.ts:39:1 › CLI and environment parsing preserve headers and timeouts (4ms)
  ✘   6 [chromium] › tests/upstream-config.spec.ts:69:1 › Commander-shaped CDP header option reaches the browser config (9ms)
  ✘   7 [chromium] › tests/upstream-config.spec.ts:83:1 › Commander-shaped secrets option parses dotenv values for redaction (17ms)
  ✘   8 [chromium] › tests/upstream-config.spec.ts:99:1 › PLAYWRIGHT_MCP_SECRETS loads the same dotenv redaction values (12ms)
  ✘   9 [chromium] › tests/upstream-config.spec.ts:111:1 › PLAYWRIGHT_MCP_CONFIG loads a configuration file before environment overrides (16ms)
  ✓  10 [chromium] › tests/upstream-config.spec.ts:138:1 › keeps Chromium-only launch flags out of Firefox and WebKit (9ms)
  ✓  11 [chromium] › tests/upstream-config.spec.ts:156:1 › numeric and heartbeat parsers reject or default invalid values (14ms)


  1) [chromium] › tests/http-allowed-hosts.spec.ts:4:1 › normalizes valid Host headers and strips ports and IPv6 brackets 

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: "::1"
    Received: "[::1]"

       5 |   expect(normalizeHostHeader('localhost:3000')).toBe('localhost');
       6 |   expect(normalizeHostHeader('127.0.0.1:3000')).toBe('127.0.0.1');
    >  7 |   expect(normalizeHostHeader('[::1]:3000')).toBe('::1');
         |                                             ^
       8 | });
       9 |
      10 | test('rejects malformed and credential-bearing Host headers', () => {
        at /home/runner/work/fast-playwright-mcp/fast-playwright-mcp/tests/http-allowed-hosts.spec.ts:7:45

    Error Context: test-results/http-allowed-hosts-normali-9557a-ips-ports-and-IPv6-brackets-chromium/error-context.md

  2) [chromium] › tests/http-allowed-hosts.spec.ts:16:1 › allows IPv4 and IPv6 loopback defaults and configured hosts 

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: true
    Received: false

      17 |   expect(isHostAllowed('localhost:3000', '127.0.0.1', undefined)).toBe(true);
      18 |   expect(isHostAllowed('127.0.0.1:3000', '127.0.0.1', undefined)).toBe(true);
    > 19 |   expect(isHostAllowed('[::1]:3000', '::1', undefined)).toBe(true);
         |                                                         ^
      20 |   expect(isHostAllowed('[::1]:3000', '[::1]', undefined)).toBe(true);
      21 |   expect(isHostAllowed('attacker.example', '127.0.0.1', undefined)).toBe(false);
      22 |   expect(isHostAllowed('mcp.internal:8080', '0.0.0.0', ['mcp.internal'])).toBe(
        at /home/runner/work/fast-playwright-mcp/fast-playwright-mcp/tests/http-allowed-hosts.spec.ts:19:57

    Error Context: test-results/http-allowed-hosts-allows--4e6c9-faults-and-configured-hosts-chromium/error-context.md

  3) [chromium] › tests/upstream-config.spec.ts:69:1 › Commander-shaped CDP header option reaches the browser config 

    Error: expect(received).toEqual(expected) // deep equality

    - Expected  - 3
    + Received  + 1

    - Object {
    -   "Authorization": "Bearer cli",
    - }
    + Object {}

      76 |   const config = await resolveCLIConfig(commanderOptions, {});
      77 |
    > 78 |   expect(config.browser.cdpHeaders).toEqual({
         |                                     ^
      79 |     Authorization: 'Bearer cli',
      80 |   });
      81 | });
        at /home/runner/work/fast-playwright-mcp/fast-playwright-mcp/tests/upstream-config.spec.ts:78:37

    Error Context: test-results/upstream-config-Commander--ff52c--reaches-the-browser-config-chromium/error-context.md

  4) [chromium] › tests/upstream-config.spec.ts:83:1 › Commander-shaped secrets option parses dotenv values for redaction 

    Error: expect(received).toEqual(expected) // deep equality

    - Expected  - 3
    + Received  + 1

    - Object {
    -   "API_TOKEN": "secret with spaces",
    - }
    + Object {}

      94 |   const config = await resolveCLIConfig(commanderOptions, {});
      95 |
    > 96 |   expect(config.secrets).toEqual({ API_TOKEN: 'secret with spaces' });
         |                          ^
      97 | });
      98 |
      99 | test('PLAYWRIGHT_MCP_SECRETS loads the same dotenv redaction values', async ({}, testInfo) => {
        at /home/runner/work/fast-playwright-mcp/fast-playwright-mcp/tests/upstream-config.spec.ts:96:26

    Error Context: test-results/upstream-config-Commander--d2618-dotenv-values-for-redaction-chromium/error-context.md

  5) [chromium] › tests/upstream-config.spec.ts:99:1 › PLAYWRIGHT_MCP_SECRETS loads the same dotenv redaction values 

    Error: expect(received).toEqual(expected) // deep equality

    - Expected  - 3
    + Received  + 1

    - Object {
    -   "ENV_TOKEN": "env secret",
    - }
    + Object {}

      106 |   );
      107 |
    > 108 |   expect(config.secrets).toEqual({ ENV_TOKEN: 'env secret' });
          |                          ^
      109 | });
      110 |
      111 | test('PLAYWRIGHT_MCP_CONFIG loads a configuration file before environment overrides', async ({}, testInfo) => {
        at /home/runner/work/fast-playwright-mcp/fast-playwright-mcp/tests/upstream-config.spec.ts:108:26

    Error Context: test-results/upstream-config-PLAYWRIGHT-f3f18-ame-dotenv-redaction-values-chromium/error-context.md

  6) [chromium] › tests/upstream-config.spec.ts:111:1 › PLAYWRIGHT_MCP_CONFIG loads a configuration file before environment overrides 

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: "minimal"
    Received: "adaptive"

      128 |   );
      129 |
    > 130 |   expect(config.toolProfile).toBe('minimal');
          |                              ^
      131 |   expect(config.timeouts).toEqual({
      132 |     action: 444,
      133 |     navigation: 222,
        at /home/runner/work/fast-playwright-mcp/fast-playwright-mcp/tests/upstream-config.spec.ts:130:30

    Error Context: test-results/upstream-config-PLAYWRIGHT-cb57f-efore-environment-overrides-chromium/error-context.md

  6 failed
    [chromium] › tests/http-allowed-hosts.spec.ts:4:1 › normalizes valid Host headers and strips ports and IPv6 brackets 
    [chromium] › tests/http-allowed-hosts.spec.ts:16:1 › allows IPv4 and IPv6 loopback defaults and configured hosts 
    [chromium] › tests/upstream-config.spec.ts:69:1 › Commander-shaped CDP header option reaches the browser config 
    [chromium] › tests/upstream-config.spec.ts:83:1 › Commander-shaped secrets option parses dotenv values for redaction 
    [chromium] › tests/upstream-config.spec.ts:99:1 › PLAYWRIGHT_MCP_SECRETS loads the same dotenv redaction values 
    [chromium] › tests/upstream-config.spec.ts:111:1 › PLAYWRIGHT_MCP_CONFIG loads a configuration file before environment overrides 
  5 passed (5.6s)

```
