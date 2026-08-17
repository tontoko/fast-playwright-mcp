import { originRoutePattern } from '../src/network-origin.js';
import { expect, test } from './fixtures.js';

function localBrowserConfig() {
  const executablePath = process.env.PLAYWRIGHT_MCP_TEST_EXECUTABLE_PATH;
  return {
    toolProfile: 'adaptive' as const,
    browser: {
      browserName: 'chromium' as const,
      isolated: true,
      launchOptions: {
        headless: true,
        ...(executablePath ? { executablePath } : {}),
      },
    },
  };
}

test('origin route patterns support URL, host-only, wildcard-port, and IPv6 forms', () => {
  expect(originRoutePattern('https://example.test')).toBe(
    'https://example.test/**'
  );
  expect(originRoutePattern('https://example.test:*')).toBe(
    'https://example.test:*/**'
  );
  expect(originRoutePattern('example.test:443')).toBe(
    '*://example.test:443/**'
  );
  expect(originRoutePattern('[::1]:*')).toBe('*://[::1]:*/**');
  expect(() => originRoutePattern('https://user@example.test')).toThrow(
    'Invalid network origin'
  );
  expect(() => originRoutePattern('https://example.test/path')).toThrow(
    'Invalid network origin'
  );
  expect(() => originRoutePattern('ftp://example.test')).toThrow(
    'Invalid network origin'
  );
});

test('allowedOrigins accepts a full URL origin', async ({
  startClient,
  server,
}) => {
  const origin = new URL(server.PREFIX).origin;
  const { client } = await startClient({
    config: {
      ...localBrowserConfig(),
      network: { allowedOrigins: [origin] },
    },
  });

  const result = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(result.isError).not.toBe(true);
});

test('blockedOrigins wins when an origin is both allowed and blocked', async ({
  startClient,
  server,
}) => {
  const origin = new URL(server.PREFIX).origin;
  const { client } = await startClient({
    config: {
      ...localBrowserConfig(),
      network: {
        allowedOrigins: [origin],
        blockedOrigins: [origin],
      },
    },
  });

  const result = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(result.isError).toBe(true);
});

test('failed context setup releases the persistent profile lock', async ({
  startClient,
  server,
}, testInfo) => {
  const executablePath = process.env.PLAYWRIGHT_MCP_TEST_EXECUTABLE_PATH;
  const { client } = await startClient({
    config: {
      toolProfile: 'adaptive',
      browser: {
        browserName: 'chromium',
        userDataDir: testInfo.outputPath('locked-user-data-dir'),
        launchOptions: {
          headless: true,
          ...(executablePath ? { executablePath } : {}),
        },
      },
      network: { allowedOrigins: ['https://example.test/path'] },
    },
  });

  const first = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  expect(first.isError).toBe(true);
  expect(first.content[0].text).toContain('Invalid network origin');

  // The invalid config still fails, but the failed setup must close its
  // browser context and release the user-data-dir lock instead of leaving
  // every later tool stuck on "Browser is already in use".
  const second = await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  expect(second.isError).toBe(true);
  expect(second.content[0].text).toContain('Invalid network origin');
  expect(second.content[0].text).not.toContain('already in use');
});
