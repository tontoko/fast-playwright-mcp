import { expect, test } from '@playwright/test';
import { WebSocket } from 'ws';
import { CDPRelayServer } from '../src/extension/cdp-relay.js';
import { startHttpServer } from '../src/http-server.js';

async function expectUpgradeRejected(
  url: string,
  options: ConstructorParameters<typeof WebSocket>[1]
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = new WebSocket(url, options);
    socket.once('open', () => {
      socket.close();
      reject(new Error('WebSocket upgrade unexpectedly succeeded'));
    });
    socket.once('unexpected-response', (_request, response) => {
      try {
        expect(response.statusCode).toBe(403);
        response.resume();
        resolve();
      } catch (error) {
        reject(error);
      }
    });
    socket.once('error', (error) => {
      reject(error);
    });
  });
}

test('CDP relay rejects untrusted Host headers', async () => {
  const server = await startHttpServer({ host: '127.0.0.1' });
  const relay = new CDPRelayServer(server, 'chromium');
  try {
    await expectUpgradeRejected(relay.extensionEndpoint(), {
      headers: { Host: 'attacker.example' },
    });
  } finally {
    relay.stop();
  }
});

test('CDP relay rejects untrusted web origins but allows extension origins', async () => {
  const server = await startHttpServer({ host: '127.0.0.1' });
  const relay = new CDPRelayServer(server, 'chromium');
  try {
    await expectUpgradeRejected(relay.extensionEndpoint(), {
      origin: 'https://attacker.example',
    });

    await new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(relay.extensionEndpoint(), {
        origin: 'chrome-extension://example-extension-id',
      });
      socket.once('open', () => {
        socket.close();
        resolve();
      });
      socket.once('error', reject);
      socket.once('unexpected-response', (_request, response) => {
        response.resume();
        reject(new Error(`Unexpected status ${response.statusCode}`));
      });
    });
  } finally {
    relay.stop();
  }
});
