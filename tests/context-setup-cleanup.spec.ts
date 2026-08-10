import type { BrowserContext } from 'playwright';
import { expect, test } from '@playwright/test';
import type {
  BrowserContextFactory,
  ClientInfo,
} from '../src/browser-context-factory.js';
import { resolveConfig } from '../src/config.js';
import { Context } from '../src/context.js';

test('context setup failure closes the created browser and permits retry', async () => {
  let locked = false;
  let createCount = 0;
  let closeCount = 0;
  const factory: BrowserContextFactory = {
    name: 'cleanup-test',
    description: 'Context cleanup test factory',
    createContext(
      _clientInfo: ClientInfo,
      _abortSignal: AbortSignal
    ) {
      if (locked) {
        return Promise.reject(new Error('Browser is already in use'));
      }
      locked = true;
      createCount++;
      const browserContext = {
        route: () => Promise.resolve(),
      } as unknown as BrowserContext;
      return Promise.resolve({
        browserContext,
        close: async () => {
          closeCount++;
          locked = false;
        },
      });
    },
  };
  const context = new Context({
    tools: [],
    config: resolveConfig({
      network: { allowedOrigins: ['https://example.test/path'] },
    }),
    browserContextFactory: factory,
    sessionLog: undefined,
    clientInfo: { name: 'cleanup-test', version: '1.0.0' },
  });

  try {
    await expect(context.ensureTab()).rejects.toThrow('Invalid network origin');
    await expect(context.ensureTab()).rejects.toThrow('Invalid network origin');
    expect(createCount).toBe(2);
    expect(closeCount).toBe(2);
    expect(locked).toBe(false);
  } finally {
    await context.dispose();
  }
});
