# PR 31 review-fix verification

- result: FAIL
- source commit: ecbe3876024399f90d006a7a47244c979fa5101b

## Test output tail

```text

Running 11 tests using 1 worker

  ✘   1 [chromium] › tests/http-allowed-hosts.spec.ts:4:1 › normalizes valid Host headers and strips ports and IPv6 brackets (13ms)
  ✓   2 [chromium] › tests/http-allowed-hosts.spec.ts:10:1 › rejects malformed and credential-bearing Host headers (9ms)
  ✘   3 [chromium] › tests/http-allowed-hosts.spec.ts:16:1 › allows IPv4 and IPv6 loopback defaults and configured hosts (8ms)
  ✓   4 [chromium] › tests/upstream-config.spec.ts:12:1 › resolves upstream-compatible configuration fields (8ms)
  ✓   5 [chromium] › tests/upstream-config.spec.ts:39:1 › CLI and environment parsing preserve headers and timeouts (4ms)
  ✓   6 [chromium] › tests/upstream-config.spec.ts:69:1 › Commander-shaped CDP header option reaches the browser config (2ms)
  ✓   7 [chromium] › tests/upstream-config.spec.ts:83:1 › Commander-shaped secrets option parses dotenv values for redaction (8ms)
  ✓   8 [chromium] › tests/upstream-config.spec.ts:99:1 › PLAYWRIGHT_MCP_SECRETS loads the same dotenv redaction values (4ms)
  ✓   9 [chromium] › tests/upstream-config.spec.ts:111:1 › PLAYWRIGHT_MCP_CONFIG loads a configuration file before environment overrides (5ms)
  ✓  10 [chromium] › tests/upstream-config.spec.ts:138:1 › keeps Chromium-only launch flags out of Firefox and WebKit (3ms)
  ✓  11 [chromium] › tests/upstream-config.spec.ts:156:1 › numeric and heartbeat parsers reject or default invalid values (10ms)


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

  2 failed
    [chromium] › tests/http-allowed-hosts.spec.ts:4:1 › normalizes valid Host headers and strips ports and IPv6 brackets 
    [chromium] › tests/http-allowed-hosts.spec.ts:16:1 › allows IPv4 and IPv6 loopback defaults and configured hosts 
  9 passed (2.4s)

```
