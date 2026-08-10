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

test('browser_take_screenshot returns WebP image data', async ({
  startClient,
  server,
}) => {
  const { client } = await startClient({ config: localBrowserConfig() });
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const result = await client.callTool({
    name: 'browser_take_screenshot',
    arguments: { type: 'webp' },
  });

  expect(result.isError).not.toBe(true);
  expect(result.content).toContainEqual(
    expect.objectContaining({ type: 'image', mimeType: 'image/webp' })
  );
});
