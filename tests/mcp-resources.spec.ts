import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, test } from '@playwright/test';
import { createServer, type ServerBackend } from '../src/mcp/server.js';

async function connectBackend(serverBackend: ServerBackend): Promise<{
  client: Client;
  close: () => Promise<void>;
}> {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createServer(serverBackend, false);
  const client = new Client({ name: 'resource-test', version: '1.0.0' });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

function createBackend(overrides: Partial<ServerBackend> = {}): ServerBackend {
  return {
    name: 'test',
    version: '1.0.0',
    tools: () => [],
    callTool: async () => ({ content: [] }),
    ...overrides,
  };
}

test('does not advertise incomplete resource support', async () => {
  const connection = await connectBackend(
    createBackend({
      resources: () => [
        { uri: 'ui://dashboard', name: 'Dashboard', mimeType: 'text/html' },
      ],
    })
  );
  await expect(connection.client.listResources()).rejects.toThrow();
  await connection.close();
});

test('lists and reads resources only when both handlers exist', async () => {
  const connection = await connectBackend(
    createBackend({
      resources: () => [
        { uri: 'ui://dashboard', name: 'Dashboard', mimeType: 'text/html' },
      ],
      readResource: (uri) => {
        if (uri !== 'ui://dashboard') {
          return Promise.reject(new Error(`Resource not found: ${uri}`));
        }
        return Promise.resolve([
          { uri, mimeType: 'text/html', text: '<!doctype html>' },
        ]);
      },
    })
  );
  expect((await connection.client.listResources()).resources).toHaveLength(1);
  expect(
    (await connection.client.readResource({ uri: 'ui://dashboard' }))
      .contents[0]
  ).toMatchObject({
    text: '<!doctype html>',
  });
  await expect(
    connection.client.readResource({ uri: 'ui://missing' })
  ).rejects.toThrow('Resource not found: ui://missing');
  await connection.close();
});

test('dashboard tool links to the bundled MCP Apps resource', async () => {
  const { browserDashboard } = await import('../src/apps/dashboard/tool.js');
  const { toMcpTool } = await import('../src/mcp/tool.js');
  expect(toMcpTool(browserDashboard.schema)).toMatchObject({
    _meta: { ui: { resourceUri: 'ui://dashboard' } },
  });
});
