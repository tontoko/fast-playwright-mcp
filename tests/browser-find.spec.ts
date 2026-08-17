import { expect, test } from './fixtures.js';

function localBrowserConfig() {
  const executablePath = process.env.PLAYWRIGHT_MCP_TEST_EXECUTABLE_PATH;
  return {
    toolProfile: 'adaptive' as const,
    browser: {
      browserName: 'chromium' as const,
      launchOptions: {
        headless: true,
        ...(executablePath ? { executablePath } : {}),
      },
    },
  };
}

test('browser_find returns compact matching snapshot context', async ({
  startClient,
  server,
}) => {
  server.setContent(
    '/find.html',
    '<main><h1>Account settings</h1><button>Save changes</button><button>Cancel</button></main>',
    'text/html'
  );
  const { client } = await startClient({ config: localBrowserConfig() });
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: `${server.PREFIX}/find.html` },
  });
  const result = await client.callTool({
    name: 'browser_find',
    arguments: { query: 'Save changes', contextLines: 1, maxResults: 5 },
  });
  expect(result).toHaveResponse({
    result: expect.stringContaining('Save changes'),
  });
  const text = result.content[0].type === 'text' ? result.content[0].text : '';
  expect(text).not.toContain('Cancel\n  -');
});

test('browser_find reports no match without returning the full snapshot', async ({
  startClient,
  server,
}) => {
  const { client } = await startClient({ config: localBrowserConfig() });
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  const result = await client.callTool({
    name: 'browser_find',
    arguments: { query: 'definitely absent' },
  });
  expect(result).toHaveResponse({
    result: expect.stringContaining('No snapshot matches'),
  });
});

test('browser_find regex search matches snapshot lines', async ({
  startClient,
  server,
}) => {
  server.setContent(
    '/find-regex.html',
    '<main><h1>Account settings</h1><button>Save changes</button></main>',
    'text/html'
  );
  const { client } = await startClient({ config: localBrowserConfig() });
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: `${server.PREFIX}find-regex.html` },
  });
  const result = await client.callTool({
    name: 'browser_find',
    arguments: { query: 'save|account', regex: true },
  });
  expect(result).toHaveResponse({
    result: expect.stringContaining('Save changes'),
  });
});

test('browser_find rejects invalid regex patterns', async ({
  startClient,
  server,
}) => {
  const { client } = await startClient({ config: localBrowserConfig() });
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });
  const result = await client.callTool({
    name: 'browser_find',
    arguments: { query: '(', regex: true },
  });
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain('Invalid regular expression');
});
