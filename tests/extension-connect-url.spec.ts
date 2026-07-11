import { expect, test } from '@playwright/test';
import {
  buildExtensionConnectUrl,
  DEFAULT_EXTENSION_ID,
} from '../src/extension/connect-url.js';

const relayEndpoint = 'ws://127.0.0.1:43123/extension/test-id';
const clientInfo = { name: 'test-client', version: '1.2.3' };

test('builds a valid URL for the bundled extension', () => {
  const url = buildExtensionConnectUrl({ relayEndpoint, clientInfo });

  expect(DEFAULT_EXTENSION_ID).toBe('jakfalbnbhgkpmoaakfflhflbfpkailf');
  expect(url.origin).toBe(`chrome-extension://${DEFAULT_EXTENSION_ID}`);
  expect(url.pathname).toBe('/connect.html');
  expect(url.searchParams.get('mcpRelayUrl')).toBe(relayEndpoint);
  expect(url.searchParams.get('client')).toBe(JSON.stringify(clientInfo));
  expect(url.searchParams.get('protocolVersion')).toBe('1');
  expect(url.searchParams.has('token')).toBe(false);
});

test('supports the current Chrome Web Store extension and auth token', () => {
  const extensionId = 'mmlmfjhmonkocbjadbfplnigmagldckm';
  const url = buildExtensionConnectUrl({
    relayEndpoint,
    clientInfo,
    extensionId,
    token: 'test-token',
  });

  expect(url.origin).toBe(`chrome-extension://${extensionId}`);
  expect(url.pathname).toBe('/connect.html');
  expect(url.searchParams.get('protocolVersion')).toBe('1');
  expect(url.searchParams.get('token')).toBe('test-token');
});

test('rejects invalid extension ids', () => {
  expect(() =>
    buildExtensionConnectUrl({
      relayEndpoint,
      clientInfo,
      extensionId: 'not-an-extension-id',
    })
  ).toThrow('Invalid Chrome extension ID format');
});
