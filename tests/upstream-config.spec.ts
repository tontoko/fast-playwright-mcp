import { writeFile } from 'node:fs/promises';
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

test('Commander-shaped CDP header option reaches the browser config', async () => {
  const commanderOptions = {
    cdpHeader: headerParser('Authorization: Bearer cli'),
  } as Parameters<typeof resolveCLIConfig>[0] & {
    cdpHeader: Record<string, string>;
  };

  const config = await resolveCLIConfig(commanderOptions, {});

  expect(config.browser.cdpHeaders).toEqual({
    Authorization: 'Bearer cli',
  });
});

test('Commander-shaped secrets option parses dotenv values for redaction', async ({}, testInfo) => {
  const secretsPath = testInfo.outputPath('secrets.env');
  await writeFile(
    secretsPath,
    'API_TOKEN="secret with spaces" # deployment token\n',
    'utf8'
  );
  const commanderOptions = {
    secrets: secretsPath,
  } as Parameters<typeof resolveCLIConfig>[0] & { secrets: string };

  const config = await resolveCLIConfig(commanderOptions, {});

  expect(config.secrets).toEqual({ API_TOKEN: 'secret with spaces' });
});

test('PLAYWRIGHT_MCP_SECRETS loads the same dotenv redaction values', async ({}, testInfo) => {
  const secretsPath = testInfo.outputPath('env-secrets.env');
  await writeFile(secretsPath, 'ENV_TOKEN="env secret"\n', 'utf8');

  const config = await resolveCLIConfig(
    {},
    { PLAYWRIGHT_MCP_SECRETS: secretsPath }
  );

  expect(config.secrets).toEqual({ ENV_TOKEN: 'env secret' });
});

test('keeps Chromium-only launch flags out of Firefox and WebKit', async () => {
  const automationControlledArg =
    '--disable-blink-features=AutomationControlled';
  const chromium = await resolveCLIConfig({ browser: 'chromium' }, {});
  const firefox = await resolveCLIConfig({ browser: 'firefox' }, {});
  const webkit = await resolveCLIConfig({ browser: 'webkit' }, {});

  expect(chromium.browser.launchOptions.args).toContain(
    automationControlledArg
  );
  expect(firefox.browser.launchOptions.args ?? []).not.toContain(
    automationControlledArg
  );
  expect(webkit.browser.launchOptions.args ?? []).not.toContain(
    automationControlledArg
  );
});

test('numeric and heartbeat parsers reject or default invalid values', () => {
  expect(() => positiveNumber('-1')).toThrow('non-negative number');
  expect(resolveHeartbeatTimeout(undefined)).toBe(5000);
  expect(resolveHeartbeatTimeout('0')).toBe(0);
  expect(resolveHeartbeatTimeout('invalid')).toBe(5000);
});
