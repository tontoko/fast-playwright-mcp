# PR 31 review-fix verification

- result: FAIL
- source commit: 58d76a32a27dc7b17d5e97ed533407cb852cf4b5

## Test output tail

```text

Running 15 tests using 1 worker

  ✓   1 [chromium] › tests/http-allowed-hosts.spec.ts:4:1 › normalizes valid Host headers and strips ports and IPv6 brackets (10ms)
  ✓   2 [chromium] › tests/http-allowed-hosts.spec.ts:10:1 › rejects malformed and credential-bearing Host headers (7ms)
  ✓   3 [chromium] › tests/http-allowed-hosts.spec.ts:16:1 › allows IPv4 and IPv6 loopback defaults and configured hosts (14ms)
  ✘   4 [chromium] › tests/output-manager.spec.ts:6:1 › evicts oldest completed files while preserving the finalized target (2ms)
  ✘   5 [chromium] › tests/output-manager.spec.ts:22:1 › does not follow file symlinks and rejects lexical path traversal (4ms)
  ✘   6 [chromium] › tests/output-manager.spec.ts:38:1 › rejects a symlinked parent that escapes the output directory (4ms)
  ✘   7 [chromium] › tests/output-manager.spec.ts:55:1 › rejects finalization targets outside the output directory (5ms)
  ✓   8 [chromium] › tests/upstream-config.spec.ts:12:1 › resolves upstream-compatible configuration fields (9ms)
  ✓   9 [chromium] › tests/upstream-config.spec.ts:39:1 › CLI and environment parsing preserve headers and timeouts (5ms)
  ✓  10 [chromium] › tests/upstream-config.spec.ts:69:1 › Commander-shaped CDP header option reaches the browser config (3ms)
  ✓  11 [chromium] › tests/upstream-config.spec.ts:83:1 › Commander-shaped secrets option parses dotenv values for redaction (10ms)
  ✓  12 [chromium] › tests/upstream-config.spec.ts:99:1 › PLAYWRIGHT_MCP_SECRETS loads the same dotenv redaction values (5ms)
  ✓  13 [chromium] › tests/upstream-config.spec.ts:111:1 › PLAYWRIGHT_MCP_CONFIG loads a configuration file before environment overrides (7ms)
  ✓  14 [chromium] › tests/upstream-config.spec.ts:138:1 › keeps Chromium-only launch flags out of Firefox and WebKit (3ms)
  ✓  15 [chromium] › tests/upstream-config.spec.ts:156:1 › numeric and heartbeat parsers reject or default invalid values (13ms)


  1) [chromium] › tests/output-manager.spec.ts:6:1 › evicts oldest completed files while preserving the finalized target 

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1232/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/output-manager-evicts-olde-1cd16-erving-the-finalized-target-chromium/error-context.md

  2) [chromium] › tests/output-manager.spec.ts:22:1 › does not follow file symlinks and rejects lexical path traversal 

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1232/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/output-manager-does-not-fo-8c2bc-ects-lexical-path-traversal-chromium/error-context.md

  3) [chromium] › tests/output-manager.spec.ts:38:1 › rejects a symlinked parent that escapes the output directory 

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1232/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/output-manager-rejects-a-s-a652c-scapes-the-output-directory-chromium/error-context.md

  4) [chromium] › tests/output-manager.spec.ts:55:1 › rejects finalization targets outside the output directory 

    Error: browserType.launch: Executable doesn't exist at /home/runner/.cache/ms-playwright/chromium_headless_shell-1232/chrome-headless-shell-linux64/chrome-headless-shell
    ╔════════════════════════════════════════════════════════════╗
    ║ Looks like Playwright was just installed or updated.       ║
    ║ Please run the following command to download new browsers: ║
    ║                                                            ║
    ║     npx playwright install                                 ║
    ║                                                            ║
    ║ <3 Playwright Team                                         ║
    ╚════════════════════════════════════════════════════════════╝

    Error Context: test-results/output-manager-rejects-fin-34332-utside-the-output-directory-chromium/error-context.md

  4 failed
    [chromium] › tests/output-manager.spec.ts:6:1 › evicts oldest completed files while preserving the finalized target 
    [chromium] › tests/output-manager.spec.ts:22:1 › does not follow file symlinks and rejects lexical path traversal 
    [chromium] › tests/output-manager.spec.ts:38:1 › rejects a symlinked parent that escapes the output directory 
    [chromium] › tests/output-manager.spec.ts:55:1 › rejects finalization targets outside the output directory 
  11 passed (3.8s)

```
