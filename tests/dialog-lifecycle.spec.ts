import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { expect, test } from './fixtures.js';

function responseText(result: CallToolResult): string {
  return result.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n');
}

test('dialog modal state clears when a side-channel client closes the dialog', async ({
  cdpServer,
  server,
  startClient,
}) => {
  server.setContent(
    '/',
    '<button onclick="alert(\'Alert from page\')">Open dialog</button>',
    'text/html'
  );
  const browserContext = await cdpServer.start();
  const [page] = browserContext.pages();
  page.on('dialog', () => {
    // Keep the dialog open for the assertion below.
  });

  const { client } = await startClient({
    args: [`--cdp-endpoint=${cdpServer.endpoint}`],
  });
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.PREFIX },
  });

  const dialogPromise = page.waitForEvent('dialog');
  const clickPromise = page
    .getByRole('button', { name: 'Open dialog' })
    .click();
  const dialog = await dialogPromise;
  expect(dialog.message()).toBe('Alert from page');

  await expect
    .poll(async () =>
      responseText(await client.callTool({ name: 'browser_snapshot' }))
    )
    .toContain('Alert from page');

  await dialog.dismiss();
  await clickPromise;

  await expect
    .poll(async () =>
      responseText(await client.callTool({ name: 'browser_snapshot' }))
    )
    .not.toContain('Alert from page');
});