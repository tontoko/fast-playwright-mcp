import { expect, test } from '@playwright/test';
import {
  configFromCLIOptions,
  headerParser,
  positiveNumber,
  resolveCLIConfig,
  resolveConfig,
} from '../src/config.js';
import { resolveHeartbeatTimeout } from '../src/mcp/server.js';

test('resolves upstream-compatible configuration fields', () => {
  const config = resolveConfig({
    browser: {
      cdpHeaders: { Authorization: 'Bearer test' },
      cdpTimeout: 12_345,
    },
    server: { allowedHosts: ['localhost', 'mcp.internal'] },
    outputMaxSize: 10_000_000,
    secrets: { API_TOKEN: 'super-secret' },
    testIdAttribute: 'data-qa',
    timeouts: { action: 7000, navigation: 80_000, expect: 9000 },
    codegen: 'none',
  });
  expect(config).toMatchObject({
    browser: {
      cdpHeaders: { Authorization: 'Bearer test' },
      cdpTimeout: 12_345,
    },
    server: { allowedHosts: ['localhost', 'mcp.internal'] },
    outputMaxSize: 10_000_000,
    secrets: { API_TOKEN: 'super-secret' },
    testIdAttribute: 'data-qa',
    timeouts: { action: 7000, navigation: 80_000, expect: 9000 },
    codegen: 'none',
  });
});

test('CLI and environment parsing preserve headers and timeouts', async () => {
  expect(
    configFromCLIOptions({
      cdpHeaders: headerParser('Authorization: Bearer test'),
      timeoutAction: 1234,
      timeoutNavigation: 5678,
      timeoutExpect: 9012,
    })
  ).toMatchObject({
    browser: { cdpHeaders: { Authorization: 'Bearer test' } },
    timeouts: { action: 1234, navigation: 5678, expect: 9012 },
  });
  expect(
    await resolveCLIConfig(
      {},
      {
        PLAYWRIGHT_MCP_CDP_HEADERS: 'Authorization: Bearer env;X-Test: value',
        PLAYWRIGHT_MCP_TIMEOUT_ACTION: '111',
        PLAYWRIGHT_MCP_TIMEOUT_NAVIGATION: '222',
        PLAYWRIGHT_MCP_TIMEOUT_EXPECT: '333',
      }
    )
  ).toMatchObject({
    browser: {
      cdpHeaders: { Authorization: 'Bearer env', 'X-Test': 'value' },
    },
    timeouts: { action: 111, navigation: 222, expect: 333 },
  });
});

test('numeric and heartbeat parsers reject or default invalid values', () => {
  expect(() => positiveNumber('-1')).toThrow('non-negative number');
  expect(resolveHeartbeatTimeout(undefined)).toBe(5000);
  expect(resolveHeartbeatTimeout('0')).toBe(0);
  expect(resolveHeartbeatTimeout('invalid')).toBe(5000);
});
