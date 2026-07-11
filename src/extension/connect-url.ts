const EXTENSION_ID_REGEX = /^[a-p]{32}$/;

/** Extension ID produced by extension/manifest.json for local development. */
export const DEFAULT_EXTENSION_ID = 'jakfalbnbhgkpmoaakfflhflbfpkailf';

/**
 * Protocol v1 is supported by both the bundled extension and the current
 * Chrome Web Store Playwright Extension. The newer v2 protocol requires a
 * different relay implementation, so advertise v1 explicitly instead of
 * relying on the extension's fallback behavior.
 */
const SUPPORTED_EXTENSION_PROTOCOL_VERSION = 1;

type ExtensionClientInfo = {
  name: string;
  version?: string;
};

type ExtensionConnectUrlOptions = {
  relayEndpoint: string;
  clientInfo: ExtensionClientInfo;
  extensionId?: string;
  token?: string;
};

export function buildExtensionConnectUrl({
  relayEndpoint,
  clientInfo,
  extensionId = DEFAULT_EXTENSION_ID,
  token,
}: ExtensionConnectUrlOptions): URL {
  if (!EXTENSION_ID_REGEX.test(extensionId)) {
    throw new Error('Invalid Chrome extension ID format');
  }

  const url = new URL(`chrome-extension://${extensionId}/connect.html`);
  url.searchParams.set('mcpRelayUrl', relayEndpoint);
  url.searchParams.set('client', JSON.stringify(clientInfo));
  url.searchParams.set(
    'protocolVersion',
    SUPPORTED_EXTENSION_PROTOCOL_VERSION.toString()
  );
  if (token) {
    url.searchParams.set('token', token);
  }
  return url;
}
