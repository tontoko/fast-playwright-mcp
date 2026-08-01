/**
 * WebSocket server that bridges Playwright MCP and Chrome Extension.
 *
 * Endpoints:
 * - /cdp/guid - Full CDP interface for Playwright MCP
 * - /extension/guid - Extension connection for chrome.debugger forwarding
 */
import { spawn } from 'node:child_process';
import type http from 'node:http';
import { platform } from 'node:os';
import { isAbsolute } from 'node:path';
// @ts-expect-error - playwright-core does not publish types for its exported coreBundle entry.
import coreBundle from 'playwright-core/lib/coreBundle';
import type websocket from 'ws';
import { WebSocket, WebSocketServer } from 'ws';
import type { ClientInfo } from '../browser-context-factory.js';
import { httpAddressToString } from '../http-server.js';
import { ManualPromise } from '../manual-promise.js';
import { cdpRelayDebug, logUnhandledError } from '../utils/log.js';
import {
  buildExtensionConnectUrl,
  DEFAULT_EXTENSION_ID,
} from './connect-url.js';
import { findExtensionProfile } from './profile.js';

const { registry } = coreBundle.registry;

const HTTP_TO_WS_REGEX = /^http/;
const MAX_MESSAGE_SIZE = 1024 * 1024;
const DANGEROUS_PROPS = new Set(['__proto__', 'constructor', 'prototype']);

type CDPParams = Record<string, unknown>;

type CDPCommand = {
  id: number;
  sessionId?: string;
  method: string;
  params?: CDPParams;
};

type CDPResponse = {
  id?: number;
  sessionId?: string;
  method?: string;
  params?: CDPParams;
  result?: unknown;
  error?: { code?: number; message: string };
};

export class CDPRelayServer {
  private readonly _httpServer: http.Server;
  private readonly _wsHost: string;
  private readonly _browserChannel: string;
  private readonly _userDataDir: string | undefined;
  private readonly _executablePath: string | undefined;
  private readonly _cdpPath: string;
  private readonly _extensionPath: string;
  private readonly _wss: WebSocketServer;
  private _playwrightConnection: WebSocket | null = null;
  private _extensionConnection: ExtensionConnection | null = null;
  private _nextSessionId = 1;
  private _connectedTabInfo:
    | {
        targetInfo: Record<string, unknown>;
        sessionId: string;
      }
    | undefined;
  private _extensionConnectionPromise!: ManualPromise<void>;

  constructor(
    server: http.Server,
    browserChannel: string,
    userDataDir?: string,
    executablePath?: string
  ) {
    this._httpServer = server;
    this._wsHost = httpAddressToString(server.address()).replace(
      HTTP_TO_WS_REGEX,
      'ws'
    );
    this._browserChannel = browserChannel;
    this._userDataDir = userDataDir;
    this._executablePath = executablePath;
    const uuid = crypto.randomUUID();
    this._cdpPath = `/cdp/${uuid}`;
    this._extensionPath = `/extension/${uuid}`;
    this._resetExtensionConnection();
    this._wss = new WebSocketServer({ server });
    this._wss.on('connection', this._onConnection.bind(this));
  }

  cdpEndpoint() {
    return `${this._wsHost}${this._cdpPath}`;
  }

  extensionEndpoint() {
    return `${this._wsHost}${this._extensionPath}`;
  }

  async ensureExtensionConnectionForMCPContext(
    clientInfo: ClientInfo,
    abortSignal: AbortSignal
  ) {
    cdpRelayDebug('Ensuring extension connection for MCP context');
    if (this._extensionConnection) {
      return;
    }

    await this._connectBrowser(clientInfo);
    cdpRelayDebug('Waiting for incoming extension connection');

    let removeAbortListener: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      const onAbort = () =>
        reject(
          abortSignal.reason instanceof Error
            ? abortSignal.reason
            : new Error('Extension connection aborted')
        );
      if (abortSignal.aborted) {
        onAbort();
        return;
      }
      abortSignal.addEventListener('abort', onAbort, { once: true });
      removeAbortListener = () =>
        abortSignal.removeEventListener('abort', onAbort);
    });

    try {
      await Promise.race([this._extensionConnectionPromise, aborted]);
    } finally {
      removeAbortListener?.();
    }
    cdpRelayDebug('Extension connection established');
  }

  private async _connectBrowser(clientInfo: ClientInfo) {
    const sanitizedClientInfo = this._sanitizeClientInfo(clientInfo);
    const extensionId =
      process.env.PLAYWRIGHT_MCP_EXTENSION_ID ?? DEFAULT_EXTENSION_ID;
    const url = buildExtensionConnectUrl({
      relayEndpoint: this.extensionEndpoint(),
      clientInfo: sanitizedClientInfo,
      extensionId,
      token: process.env.PLAYWRIGHT_MCP_EXTENSION_TOKEN,
    });

    const executablePath = this._resolveBrowserExecutablePath();
    const args: string[] = [];
    if (this._userDataDir) {
      args.push(`--user-data-dir=${this._userDataDir}`);
      if (!this._executablePath) {
        const profile = await findExtensionProfile(
          this._userDataDir,
          extensionId
        );
        if (profile) {
          args.push(`--profile-directory=${profile}`);
        }
      }
    }
    if (platform() === 'linux' && this._browserChannel === 'chromium') {
      args.push('--no-sandbox');
    }
    args.push(url.toString());

    spawn(executablePath, args, {
      windowsHide: true,
      detached: true,
      shell: false,
      stdio: 'ignore',
    });
  }

  private _resolveBrowserExecutablePath(): string {
    let executablePath = this._executablePath;
    if (!executablePath) {
      const executableInfo = registry.findExecutable(this._browserChannel);
      if (!executableInfo) {
        throw new Error(`Unsupported channel: "${this._browserChannel}"`);
      }
      executablePath = executableInfo.executablePath();
      if (!executablePath) {
        throw new Error(
          `"${this._browserChannel}" executable not found. Make sure it is installed at a standard location.`
        );
      }
    }

    // spawn() is invoked with shell:false, so shell metacharacters in legitimate
    // paths (for example "Program Files (x86)" on Windows) are safe. Requiring
    // an absolute path prevents accidental PATH lookup without rejecting valid
    // platform paths.
    if (!isAbsolute(executablePath)) {
      throw new Error('Browser executable path must be absolute');
    }
    return executablePath;
  }

  private _sanitizeClientInfo(clientInfo: ClientInfo): {
    name: string;
    version: string;
  } {
    const sanitize = (value: unknown, fallback: string, maxLength: number) => {
      const text = typeof value === 'string' ? value : fallback;
      return text
        .slice(0, maxLength)
        .replace(/<script[^>]*>.*?<\/script>/giu, '');
    };

    return {
      name: sanitize(clientInfo.name, 'unknown', 100),
      version: sanitize(clientInfo.version, '1.0.0', 20),
    };
  }

  private _safeJsonParse<T = unknown>(jsonString: string): T | null {
    try {
      const result: unknown = JSON.parse(jsonString);
      this._sanitizeJsonValue(result);
      return result as T;
    } catch (error) {
      cdpRelayDebug('JSON parsing failed:', error);
      return null;
    }
  }

  private _sanitizeJsonValue(value: unknown): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        this._sanitizeJsonValue(item);
      }
      return;
    }
    if (!value || typeof value !== 'object') {
      return;
    }

    const object = value as Record<string, unknown>;
    for (const key of Object.keys(object)) {
      if (DANGEROUS_PROPS.has(key)) {
        delete object[key];
        continue;
      }
      this._sanitizeJsonValue(object[key]);
    }
  }

  private _isValidCDPCommand(message: unknown): message is CDPCommand {
    if (!message || typeof message !== 'object') {
      return false;
    }

    const command = message as Record<string, unknown>;
    return (
      typeof command.id === 'number' &&
      typeof command.method === 'string' &&
      (command.sessionId === undefined ||
        typeof command.sessionId === 'string') &&
      (command.params === undefined ||
        (typeof command.params === 'object' && command.params !== null))
    );
  }

  stop(): void {
    this._closeConnections('Server stopped');
    this._wss.close();
    if (this._httpServer.listening) {
      this._httpServer.close();
    }
  }

  private _closeConnections(reason: string) {
    this._closePlaywrightConnection(reason);
    this._closeExtensionConnection(reason);
  }

  private _onConnection(ws: WebSocket, request: http.IncomingMessage): void {
    const url = new URL(`http://localhost${request.url}`);
    cdpRelayDebug(`New connection to ${url.pathname}`);
    if (url.pathname === this._cdpPath) {
      this._handlePlaywrightConnection(ws);
    } else if (url.pathname === this._extensionPath) {
      this._handleExtensionConnection(ws);
    } else {
      ws.close(4004, 'Invalid path');
    }
  }

  private _handlePlaywrightConnection(ws: WebSocket): void {
    if (!this._extensionConnection) {
      ws.close(1000, 'Extension not connected');
      return;
    }
    if (this._playwrightConnection) {
      cdpRelayDebug('Rejecting second Playwright connection');
      ws.close(1000, 'Another CDP client already connected');
      return;
    }

    this._playwrightConnection = ws;
    ws.on('message', async (data) => {
      try {
        const messageString = data.toString();
        if (messageString.length > MAX_MESSAGE_SIZE) {
          cdpRelayDebug('Message too large, rejecting');
          ws.close(1009, 'Message too large');
          return;
        }

        const message = this._safeJsonParse(messageString);
        if (message === null) {
          cdpRelayDebug('Invalid JSON message received from Playwright');
          return;
        }
        await this._handlePlaywrightMessage(message);
      } catch (error: unknown) {
        const truncatedData = String(data).slice(0, 500);
        cdpRelayDebug(
          `Error while handling Playwright message\n${truncatedData}...\n`,
          error
        );
      }
    });
    ws.on('close', () => {
      if (this._playwrightConnection !== ws) {
        return;
      }
      this._playwrightConnection = null;
      this._closeExtensionConnection('Playwright client disconnected');
      cdpRelayDebug('Playwright WebSocket closed');
    });
    ws.on('error', (error) => {
      cdpRelayDebug('Playwright WebSocket error:', error);
    });
    cdpRelayDebug('Playwright MCP connected');
  }

  private _closeExtensionConnection(reason: string) {
    const connection = this._extensionConnection;
    this._extensionConnection = null;
    connection?.close(reason);
    if (!this._extensionConnectionPromise.isDone()) {
      this._extensionConnectionPromise.reject(new Error(reason));
    }
    this._resetExtensionConnection();
  }

  private _resetExtensionConnection() {
    this._connectedTabInfo = undefined;
    this._extensionConnectionPromise = new ManualPromise();
    this._extensionConnectionPromise.catch(logUnhandledError);
  }

  private _closePlaywrightConnection(reason: string) {
    if (this._playwrightConnection?.readyState === WebSocket.OPEN) {
      this._playwrightConnection.close(1000, reason);
    }
    this._playwrightConnection = null;
  }

  private _handleExtensionConnection(ws: WebSocket): void {
    if (this._extensionConnection) {
      ws.close(1000, 'Another extension connection already established');
      return;
    }

    const connection = new ExtensionConnection(ws);
    this._extensionConnection = connection;
    connection.onclose = (closedConnection, reason) => {
      cdpRelayDebug(
        'Extension WebSocket closed:',
        reason,
        closedConnection === this._extensionConnection
      );
      if (this._extensionConnection !== closedConnection) {
        return;
      }
      this._extensionConnection = null;
      this._resetExtensionConnection();
      this._closePlaywrightConnection(`Extension disconnected: ${reason}`);
    };
    connection.onmessage = this._handleExtensionMessage.bind(this);
    if (!this._extensionConnectionPromise.isDone()) {
      this._extensionConnectionPromise.resolve();
    }
  }

  private _handleExtensionMessage(
    method: string,
    params: Record<string, unknown>
  ) {
    switch (method) {
      case 'forwardCDPEvent': {
        const sessionId =
          (params.sessionId as string | undefined) ??
          this._connectedTabInfo?.sessionId;
        this._sendToPlaywright({
          sessionId,
          method: params.method as string | undefined,
          params: params.params as CDPParams | undefined,
        });
        break;
      }
      case 'detachedFromTab':
        cdpRelayDebug('← Debugger detached from tab:', params);
        this._connectedTabInfo = undefined;
        break;
      default:
        cdpRelayDebug(`← Extension: unhandled method ${method}`, params);
        break;
    }
  }

  private async _handlePlaywrightMessage(message: unknown): Promise<void> {
    if (!this._isValidCDPCommand(message)) {
      cdpRelayDebug('Invalid CDP command received from Playwright');
      return;
    }

    cdpRelayDebug('← Playwright:', `${message.method} (id=${message.id})`);
    const { id, sessionId, method, params } = message;
    try {
      const result = await this._handleCDPCommand(method, params, sessionId);
      this._sendToPlaywright({ id, sessionId, result });
    } catch (error) {
      cdpRelayDebug('Error in the extension:', error);
      this._sendToPlaywright({
        id,
        sessionId,
        error: {
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private async _handleCDPCommand(
    method: string,
    params: CDPParams | undefined,
    sessionId: string | undefined
  ): Promise<unknown> {
    switch (method) {
      case 'Browser.getVersion':
        return {
          protocolVersion: '1.3',
          product: 'Chrome/Extension-Bridge',
          userAgent: 'CDP-Bridge-Server/1.0.0',
        };
      case 'Browser.setDownloadBehavior':
        return {};
      case 'Target.setAutoAttach': {
        if (sessionId) {
          break;
        }
        const result = (await this._extensionConnection?.send(
          'attachToTab'
        )) as { targetInfo: Record<string, unknown> };
        if (!result?.targetInfo) {
          throw new Error('Extension did not return target information');
        }
        this._connectedTabInfo = {
          targetInfo: result.targetInfo,
          sessionId: `pw-tab-${this._nextSessionId++}`,
        };
        this._sendToPlaywright({
          method: 'Target.attachedToTarget',
          params: {
            sessionId: this._connectedTabInfo.sessionId,
            targetInfo: {
              ...this._connectedTabInfo.targetInfo,
              attached: true,
            },
            waitingForDebugger: false,
          },
        });
        return {};
      }
      case 'Target.getTargetInfo':
        return this._connectedTabInfo?.targetInfo;
      default:
        break;
    }
    return this._forwardToExtension(method, params, sessionId);
  }

  private _forwardToExtension(
    method: string,
    params: CDPParams | undefined,
    sessionId: string | undefined
  ): Promise<unknown> {
    if (!this._extensionConnection) {
      throw new Error('Extension not connected');
    }

    let effectiveSessionId = sessionId;
    if (this._connectedTabInfo?.sessionId === sessionId) {
      effectiveSessionId = undefined;
    }
    return this._extensionConnection.send('forwardCDPCommand', {
      sessionId: effectiveSessionId,
      method,
      params,
    });
  }

  private _sendToPlaywright(message: CDPResponse): void {
    const messageDescription = message.method ?? `response(id=${message.id})`;
    cdpRelayDebug('→ Playwright:', messageDescription);
    if (this._playwrightConnection?.readyState === WebSocket.OPEN) {
      this._playwrightConnection.send(JSON.stringify(message));
    }
  }
}

type ExtensionResponse = {
  id?: number;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: string;
};

class ExtensionConnection {
  private readonly _ws: WebSocket;
  private readonly _callbacks = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      error: Error;
    }
  >();
  private _lastId = 0;
  private _closed = false;

  onmessage?: (method: string, params: Record<string, unknown>) => void;
  onclose?: (self: ExtensionConnection, reason: string) => void;

  constructor(ws: WebSocket) {
    this._ws = ws;
    this._ws.on('message', this._onMessage.bind(this));
    this._ws.on('close', this._onClose.bind(this));
    this._ws.on('error', this._onError.bind(this));
  }

  send(method: string, params?: CDPParams): Promise<unknown> {
    if (this._ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Unexpected WebSocket state: ${this._ws.readyState}`);
    }

    const id = ++this._lastId;
    this._ws.send(JSON.stringify({ id, method, params }));
    const error = new Error(`Protocol error: ${method}`);
    return new Promise((resolve, reject) => {
      this._callbacks.set(id, { resolve, reject, error });
    });
  }

  close(message: string) {
    cdpRelayDebug('Closing extension connection:', message);
    if (this._ws.readyState === WebSocket.OPEN) {
      this._ws.close(1000, message);
    }
    this._dispose();
  }

  private _onMessage(event: websocket.RawData) {
    const eventData = event.toString();
    if (eventData.length > MAX_MESSAGE_SIZE) {
      this._ws.close(1009, 'Message too large');
      return;
    }

    let message: ExtensionResponse;
    try {
      message = JSON.parse(eventData) as ExtensionResponse;
    } catch (error) {
      cdpRelayDebug('Closing websocket due to malformed JSON:', error);
      this._ws.close(1007, 'Malformed JSON');
      return;
    }

    try {
      this._handleParsedMessage(message);
    } catch (error) {
      cdpRelayDebug('Closing websocket after message handling failed:', error);
      this._ws.close(1011, 'Message handling failed');
    }
  }

  private _handleParsedMessage(message: ExtensionResponse) {
    if (message.id !== undefined) {
      const callback = this._callbacks.get(message.id);
      if (!callback) {
        cdpRelayDebug('← Extension: unexpected response', message);
        return;
      }
      this._callbacks.delete(message.id);
      if (message.error) {
        callback.error.message = message.error;
        callback.reject(callback.error);
      } else {
        callback.resolve(message.result);
      }
      return;
    }

    if (message.method) {
      this.onmessage?.(message.method, message.params ?? {});
    }
  }

  private _onClose(event: websocket.CloseEvent) {
    if (this._closed) {
      return;
    }
    this._closed = true;
    cdpRelayDebug(`<ws closed> code=${event.code} reason=${event.reason}`);
    this._dispose();
    this.onclose?.(this, event.reason);
  }

  private _onError(event: websocket.ErrorEvent) {
    cdpRelayDebug(`<ws error> message=${event.message} type=${event.type}`);
    this._dispose();
  }

  private _dispose() {
    for (const callback of this._callbacks.values()) {
      callback.reject(new Error('WebSocket closed'));
    }
    this._callbacks.clear();
  }
}
