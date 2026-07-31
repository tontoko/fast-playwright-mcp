import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { expect, test } from '@playwright/test';
import { z } from 'zod';
import {
  createServer,
  type ServerBackend,
} from '../src/mcp/server.js';
import type { ToolSchema } from '../src/mcp/types.js';

const pingTool: ToolSchema = {
  name: 'ping_tool',
  title: 'Ping tool',
  description: 'Return pong.',
  inputSchema: z.object({}),
  type: 'readOnly',
};

function backend(
  initialize?: ServerBackend['initialize']
): ServerBackend {
  return {
    name: 'initialization-test',
    version: '1.0.0',
    initialize,
    tools: () => [pingTool],
    callTool: async () => ({
      content: [{ type: 'text', text: 'pong' }],
    }),
  };
}

async function connect(serverBackend: ServerBackend) {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createServer(serverBackend, false);
  const client = new Client({ name: 'initialize-test', version: '1.0.0' });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { client, server };
}

function timeout<T>(milliseconds: number): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(
      () => reject(new Error(`request timed out after ${milliseconds}ms`)),
      milliseconds
    );
  });
}

test('tool calls proceed when the backend has no initialize hook', async () => {
  const { client, server } = await connect(backend());
  try {
    const result = await Promise.race([
      client.callTool({ name: pingTool.name, arguments: {} }),
      timeout(500),
    ]);
    expect(result.content[0]).toMatchObject({ type: 'text', text: 'pong' });
  } finally {
    await client.close();
    await server.close();
  }
});

test('backend initialization failures reject pending tool calls', async () => {
  const { client, server } = await connect(
    backend(() => Promise.reject(new Error('backend initialization failed')))
  );
  try {
    await expect(
      Promise.race([
        client.callTool({ name: pingTool.name, arguments: {} }),
        timeout(500),
      ])
    ).rejects.toThrow('backend initialization failed');
  } finally {
    await client.close();
    await server.close();
  }
});
