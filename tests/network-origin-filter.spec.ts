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
