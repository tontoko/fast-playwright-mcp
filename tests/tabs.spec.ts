/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { expect, test } from './fixtures.js';
import type { TestServer } from './testserver/index.js';

type CreatedTab = {
  result: Awaited<ReturnType<Client['callTool']>>;
  url: string;
};

async function createTab(
  client: Client,
  server: TestServer,
  title: string,
  body: string
): Promise<CreatedTab> {
  const pathname = `/tabs/${encodeURIComponent(title)}.html`;
  const url = `${server.PREFIX}${pathname.slice(1)}`;
  server.setContent(
    pathname,
    `<title>${title}</title><body>${body}</body>`,
    'text/html'
  );
  return {
    result: await client.callTool({
      name: 'browser_tab_new',
      arguments: { url },
    }),
    url,
  };
}

function responseText(result: CreatedTab['result']): string {
  return result.content
    .map((part) => (part.type === 'text' ? part.text : ''))
    .join('\n');
}

test('list initial tabs', async ({ client }) => {
  expect(
    await client.callTool({
      name: 'browser_tab_list',
    })
  ).toHaveResponse({
    tabs: '- 0: (current) [] (about:blank)',
  });
});

test('list first tab', async ({ client, server }) => {
  const tabOne = await createTab(client, server, 'Tab one', 'Body one');
  expect(
    await client.callTool({
      name: 'browser_tab_list',
    })
  ).toHaveResponse({
    tabs: `- 0: [] (about:blank)
- 1: (current) [Tab one] (${tabOne.url})`,
  });
});

test('create new tab', async ({ client, server }) => {
  const tabOne = await createTab(client, server, 'Tab one', 'Body one');
  expect(tabOne.result).toHaveResponse({
    tabs: `- 0: [] (about:blank)
- 1: (current) [Tab one] (${tabOne.url})`,
    pageState: expect.stringContaining(`- **Page URL:** ${tabOne.url}
- **Page Title:** Tab one
- Page Snapshot:
\`\`\`yaml
- generic [active] [ref=e1]: Body one
\`\`\``),
  });

  const tabTwo = await createTab(client, server, 'Tab two', 'Body two');
  expect(tabTwo.result).toHaveResponse({
    tabs: `- 0: [] (about:blank)
- 1: [Tab one] (${tabOne.url})
- 2: (current) [Tab two] (${tabTwo.url})`,
    pageState: expect.stringContaining(`- **Page URL:** ${tabTwo.url}
- **Page Title:** Tab two
- Page Snapshot:
\`\`\`yaml
- generic [active] [ref=e1]: Body two
\`\`\``),
  });
});

test('select tab', async ({ client, server }) => {
  const tabOne = await createTab(client, server, 'Tab one', 'Body one');
  const tabTwo = await createTab(client, server, 'Tab two', 'Body two');

  expect(
    await client.callTool({
      name: 'browser_tab_select',
      arguments: {
        index: 1,
      },
    })
  ).toHaveResponse({
    tabs: `- 0: [] (about:blank)
- 1: (current) [Tab one] (${tabOne.url})
- 2: [Tab two] (${tabTwo.url})`,
    pageState: expect.stringContaining(`- **Page URL:** ${tabOne.url}
- **Page Title:** Tab one
- Page Snapshot:
\`\`\`yaml
- generic [active] [ref=e1]: Body one
\`\`\``),
  });
});

test('close tab', async ({ client, server }) => {
  const tabOne = await createTab(client, server, 'Tab one', 'Body one');
  await createTab(client, server, 'Tab two', 'Body two');

  expect(
    await client.callTool({
      name: 'browser_tab_close',
      arguments: {
        index: 2,
      },
    })
  ).toHaveResponse({
    tabs: `- 0: [] (about:blank)
- 1: (current) [Tab one] (${tabOne.url})`,
    pageState: expect.stringContaining(`- **Page URL:** ${tabOne.url}
- **Page Title:** Tab one
- Page Snapshot:
\`\`\`yaml
- generic [active] [ref=e1]: Body one
\`\`\``),
  });
});

test('reuse first tab when navigating', async ({
  startClient,
  cdpServer,
  server,
}) => {
  const browserContext = await cdpServer.start();
  const pages = browserContext.pages();

  const { client } = await startClient({
    args: [`--cdp-endpoint=${cdpServer.endpoint}`],
  });
  await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  expect(pages).toHaveLength(1);
  expect(await pages[0].title()).toBe('Title');
});

test('browser_snapshot applies maxLength to a partial snapshot', async ({
  client,
  server,
}) => {
  await createTab(
    client,
    server,
    'Length Test',
    `<main><p>Visible prefix ${'x'.repeat(200)} sentinel-tail</p></main>`
  );

  const result = await client.callTool({
    name: 'browser_snapshot',
    arguments: {
      expectation: {
        snapshotOptions: { selector: 'main', maxLength: 80 },
      },
    },
  });
  const text = responseText(result);
  expect(text).toContain('Visible prefix');
  expect(text).not.toContain('sentinel-tail');
});

test('browser_snapshot limits a partial snapshot to the selected landmark', async ({
  client,
  server,
}) => {
  await createTab(
    client,
    server,
    'Snapshot Test',
    '<header>Header content</header>' +
      '<main>Main content for testing</main>' +
      '<footer>Footer content</footer>'
  );

  const result = await client.callTool({
    name: 'browser_snapshot',
    arguments: {
      expectation: { snapshotOptions: { selector: 'main' } },
    },
  });
  const text = responseText(result);
  expect(text).toContain('Main content for testing');
  expect(text).not.toContain('Header content');
  expect(text).not.toContain('Footer content');
});
