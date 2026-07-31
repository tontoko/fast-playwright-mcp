import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, test } from '@playwright/test';
import type {
  BrowserContextFactory,
  ClientInfo,
} from '../src/browser-context-factory.js';
import { BrowserServerBackend } from '../src/browser-server-backend.js';
import { resolveConfig } from '../src/config.js';
import { createServer } from '../src/mcp/server.js';
import { createBaseToolRegistry } from '../src/tools.js';

const factory: BrowserContextFactory = {
  name: 'test',
  description: 'test factory',
  createContext(_clientInfo: ClientInfo, _signal: AbortSignal) {
    return Promise.reject(
      new Error('Browser context should not be created in catalog tests')
    );
  },
};

async function createClient(
  profile: 'adaptive' | 'minimal' | 'full' = 'adaptive'
) {
  const backend = new BrowserServerBackend(
    resolveConfig({ toolProfile: profile }),
    [factory]
  );
  const server = createServer(backend, false);
  const client = new Client({ name: 'gateway-test', version: '1.0.0' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server };
}

test('adaptive catalog exposes seven bootstrap tools and can enable more', async () => {
  const { client, server } = await createClient();
  const initial = (await client.listTools()).tools
    .map((tool) => tool.name)
    .sort();
  expect(initial).toEqual([
    'browser_batch_execute',
    'browser_execute',
    'browser_find',
    'browser_navigate',
    'browser_query',
    'browser_snapshot',
    'browser_tools',
  ]);
  await client.callTool({
    name: 'browser_tools',
    arguments: { action: 'enable', tools: ['browser_console_messages'] },
  });
  expect((await client.listTools()).tools.map((tool) => tool.name)).toContain(
    'browser_console_messages'
  );
  await client.close();
  await server.close();
});

test('snapshot is a read-only gateway target', () => {
  const registry = createBaseToolRegistry(resolveConfig({}));
  expect(registry.require('browser_snapshot').tool.schema.type).toBe(
    'readOnly'
  );
});

test('hidden tools resolve directly and gateways enforce effects', async () => {
  const { client, server } = await createClient();
  const direct = await client.callTool({
    name: 'browser_tab_list',
    arguments: { expectation: {} },
  });
  expect(direct.isError).toBe(true);
  expect(direct.content[0]).toMatchObject({
    text: expect.stringContaining(
      'Browser context should not be created in catalog tests'
    ),
  });
  expect(direct.content[0]).not.toMatchObject({
    text: expect.stringContaining('Tool "browser_tab_list" not found'),
  });
  const query = await client.callTool({
    name: 'browser_query',
    arguments: { tool: 'browser_tab_list', arguments: { expectation: {} } },
  });
  expect(query.isError).toBe(true);
  expect(query.content[0]).toMatchObject({
    text: expect.stringContaining(
      'Browser context should not be created in catalog tests'
    ),
  });
  expect(query.content[0]).not.toMatchObject({
    text: expect.stringContaining('Unknown tool: browser_tab_list'),
  });
  const rejected = await client.callTool({
    name: 'browser_query',
    arguments: { tool: 'browser_navigate', arguments: { url: 'about:blank' } },
  });
  expect(rejected.isError).toBe(true);
  expect(rejected.content[0]).toMatchObject({
    text: expect.stringContaining('browser_query only accepts read-only tools'),
  });
  await client.close();
  await server.close();
});
