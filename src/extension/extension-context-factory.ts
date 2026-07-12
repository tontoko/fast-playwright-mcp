import { type Browser, type BrowserContext, chromium } from 'playwright';
import type {
  BrowserContextFactory,
  ClientInfo,
} from '../browser-context-factory.js';
import { startHttpServer } from '../http-server.js';
import { extensionContextFactoryDebug } from '../utils/log.js';
import { CDPRelayServer } from './cdp-relay.js';

export class ExtensionContextFactory implements BrowserContextFactory {
  name = 'extension';
  description = 'Connect to a browser using the Playwright MCP extension';
  private readonly _browserChannel: string;
  private readonly _userDataDir: string | undefined;
  private readonly _executablePath: string | undefined;
  private _relayPromise: Promise<CDPRelayServer> | undefined;
  private _browserPromise: Promise<Browser> | undefined;

  constructor(
    browserChannel: string,
    userDataDir?: string,
    executablePath?: string
  ) {
    this._browserChannel = browserChannel;
    this._userDataDir = userDataDir;
    this._executablePath = executablePath;
  }

  async createContext(
    clientInfo: ClientInfo,
    abortSignal: AbortSignal
  ): Promise<{
    browserContext: BrowserContext;
    close: () => Promise<void>;
  }> {
    // First call will establish the connection to the extension.
    this._browserPromise ??= this._obtainBrowser(clientInfo, abortSignal);
    const browser = await this._browserPromise;
    return {
      browserContext: browser.contexts()[0],
      close: async () => {
        extensionContextFactoryDebug('close() called for browser context');
        await browser.close();
        this._browserPromise = undefined;
      },
    };
  }

  private async _obtainBrowser(
    clientInfo: ClientInfo,
    abortSignal: AbortSignal
  ): Promise<Browser> {
    this._relayPromise ??= this._startRelay(abortSignal);
    const relay = await this._relayPromise;
    abortSignal.throwIfAborted();
    await relay.ensureExtensionConnectionForMCPContext(clientInfo, abortSignal);
    const browser = await chromium.connectOverCDP(relay.cdpEndpoint());
    browser.on('disconnected', () => {
      this._browserPromise = undefined;
      extensionContextFactoryDebug('Browser disconnected');
    });
    return browser;
  }

  private async _startRelay(abortSignal: AbortSignal) {
    // Both the bundled and current Web Store extensions intentionally reject
    // non-numeric hosts. Binding explicitly also avoids exposing the relay on
    // every interface when the OS default is :: or 0.0.0.0.
    const httpServer = await startHttpServer({ host: '127.0.0.1' });
    extensionContextFactoryDebug(
      'Starting CDP relay',
      JSON.stringify({
        browserChannel: this._browserChannel,
        executablePath: this._executablePath,
        userDataDir: this._userDataDir,
      })
    );
    const cdpRelayServer = new CDPRelayServer(
      httpServer,
      this._browserChannel,
      this._userDataDir,
      this._executablePath
    );
    extensionContextFactoryDebug(
      `CDP relay server started, extension endpoint: ${cdpRelayServer.extensionEndpoint()}.`
    );
    if (abortSignal.aborted) {
      cdpRelayServer.stop();
    } else {
      abortSignal.addEventListener('abort', () => cdpRelayServer.stop(), {
        once: true,
      });
    }
    return cdpRelayServer;
  }
}
