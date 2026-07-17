import { dirname } from 'node:path';
import { type BrowserContext, type Page, selectors } from 'playwright';
import type * as actions from './actions.js';
import { BatchExecutor } from './batch/batch-executor.js';
import type {
  BrowserContextFactory,
  ClientInfo,
} from './browser-context-factory.js';
import type { FullConfig } from './config.js';
import { outputFile } from './config.js';
import type { ToolResponse } from './mcp/types.js';
import { OutputManager } from './output-manager.js';
import type { SessionLog } from './session-log.js';
import { Tab } from './tab.js';
import type { Tool } from './tools/tool.js';
import type { BatchContext } from './types/batch.js';
import { contextDebug, logUnhandledError, testDebug } from './utils/log.js';
import { SecretRedactor } from './utils/secret-redactor.js';

type ContextOptions = {
  tools: Tool[];
  config: FullConfig;
  browserContextFactory: BrowserContextFactory;
  sessionLog: SessionLog | undefined;
  clientInfo: ClientInfo;
};

export class Context {
  readonly tools: Tool[];
  readonly config: FullConfig;
  readonly sessionLog: SessionLog | undefined;
  readonly options: ContextOptions;
  readonly secretRedactor: SecretRedactor;
  private _browserContextPromise:
    | Promise<{
        browserContext: BrowserContext;
        close: () => Promise<void>;
        traceDir?: string;
      }>
    | undefined;
  private readonly _browserContextFactory: BrowserContextFactory;
  private readonly _tabs: Tab[] = [];
  private _currentTab: Tab | undefined;
  private readonly _clientInfo: ClientInfo;
  private _batchExecutor: BatchExecutor | undefined;
  private static readonly _allContexts = new Set<Context>();
  private static _testIdAttribute: string | undefined;
  private static _testIdAttributeUsers = 0;
  private _closeBrowserContextPromise: Promise<void> | undefined;
  private _outputManagerPromise: Promise<OutputManager> | undefined;
  private _isRunningTool = false;
  private _disposed = false;
  private readonly _abortController = new AbortController();
  batchContext?: BatchContext;

  constructor(options: ContextOptions) {
    this.tools = options.tools;
    this.config = options.config;
    this.sessionLog = options.sessionLog;
    this.options = options;
    this.secretRedactor = new SecretRedactor(options.config.secrets);
    this._browserContextFactory = options.browserContextFactory;
    this._clientInfo = options.clientInfo;
    this._acquireTestIdAttribute(options.config.testIdAttribute);
    testDebug('create context');
    Context._allContexts.add(this);
  }

  static async disposeAll() {
    await Promise.all(
      [...Context._allContexts].map((context) => context.dispose())
    );
  }

  tabs(): Tab[] {
    return this._tabs;
  }

  currentTab(): Tab | undefined {
    return this._currentTab;
  }

  currentTabOrDie(): Tab {
    if (!this._currentTab) {
      throw new Error(
        'No open pages available. Use the "browser_navigate" tool to navigate to a page first.'
      );
    }
    return this._currentTab;
  }

  async newTab(): Promise<Tab> {
    contextDebug('Creating new tab');
    const { browserContext } = await this._ensureBrowserContext();
    const page = await browserContext.newPage();
    const tab = this._tabs.find((candidate) => candidate.page === page);
    if (!tab) {
      throw new Error('Failed to create tab: tab not found after creation');
    }
    this._currentTab = tab;
    return tab;
  }

  async selectTab(index: number) {
    const tab = this._tabs[index];
    if (!tab) {
      throw new Error(`Tab ${index} not found`);
    }
    await tab.page.bringToFront();
    this._currentTab = tab;
    return tab;
  }

  async ensureTab(): Promise<Tab> {
    const { browserContext } = await this._ensureBrowserContext();
    if (!this._currentTab) {
      await browserContext.newPage();
    }
    if (!this._currentTab) {
      throw new Error('Failed to ensure a current browser tab.');
    }
    return this._currentTab;
  }

  async closeTab(index: number | undefined): Promise<string> {
    const tab = index === undefined ? this._currentTab : this._tabs[index];
    if (!tab) {
      throw new Error(`Tab ${index} not found`);
    }
    const url = tab.page.url();
    await tab.page.close();
    return url;
  }

  async outputFile(name: string): Promise<string> {
    const path = await outputFile(this.config, this._clientInfo.rootPath, name);
    const manager = await this._getOutputManager(path);
    return manager.reserveFile(path);
  }

  async finalizeOutputFile(path: string): Promise<void> {
    const manager = await this._getOutputManager(path);
    await manager.finalizeFile(path);
  }

  async finalizeOutputDirectory(path: string): Promise<void> {
    const manager = await this._getOutputManager(path);
    await manager.finalizeDirectory(path);
  }

  redactToolResponse(response: ToolResponse): ToolResponse {
    if (!this.secretRedactor.enabled) {
      return response;
    }
    return {
      ...response,
      content: response.content.map((part) =>
        part.type === 'text'
          ? { ...part, text: this.secretRedactor.redact(part.text) }
          : part
      ),
    };
  }

  private _getOutputManager(path: string): Promise<OutputManager> {
    this._outputManagerPromise ??= Promise.resolve(
      new OutputManager(dirname(path), this.config.outputMaxSize)
    );
    return this._outputManagerPromise;
  }

  private _onPageCreated(page: Page) {
    const newTab = new Tab(this, page, (closedTab) =>
      this._onPageClosed(closedTab)
    );
    this._tabs.push(newTab);
    this._currentTab ??= newTab;
  }

  private _onPageClosed(tab: Tab) {
    const index = this._tabs.indexOf(tab);
    if (index === -1) {
      return;
    }
    this._tabs.splice(index, 1);
    if (this._currentTab === tab) {
      this._currentTab = this._tabs[Math.min(index, this._tabs.length - 1)];
    }
    if (!this._tabs.length) {
      this.closeBrowserContext().catch((error) => {
        contextDebug('Error closing browser context:', error);
      });
    }
  }

  async closeBrowserContext() {
    contextDebug('Closing browser context');
    this._closeBrowserContextPromise ??= this._closeBrowserContextImpl().catch(
      (error) => {
        contextDebug('Failed to close browser context:', error);
        logUnhandledError(error);
      }
    );
    await this._closeBrowserContextPromise;
    this._closeBrowserContextPromise = undefined;
  }

  isRunningTool() {
    return this._isRunningTool;
  }

  setRunningTool(isRunningTool: boolean) {
    this._isRunningTool = isRunningTool;
  }

  getBatchExecutor(): BatchExecutor {
    this._batchExecutor ??= (() => {
      const toolRegistry = new Map<string, Tool>();
      for (const tool of this.tools) {
        toolRegistry.set(tool.schema.name, tool);
      }
      return new BatchExecutor(this, toolRegistry);
    })();
    return this._batchExecutor;
  }

  private async _closeBrowserContextImpl() {
    if (!this._browserContextPromise) {
      return;
    }
    testDebug('close context');
    const promise = this._browserContextPromise;
    this._browserContextPromise = undefined;
    await promise.then(async ({ browserContext, close, traceDir }) => {
      if (this.config.saveTrace) {
        await browserContext.tracing.stop();
        if (traceDir) {
          await this.finalizeOutputDirectory(traceDir);
        }
      }
      await close();
    });
  }

  async dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this._abortController.abort('MCP context disposed');
    await this.closeBrowserContext();
    Context._allContexts.delete(this);
    Context._testIdAttributeUsers--;
    if (Context._testIdAttributeUsers === 0) {
      Context._testIdAttribute = undefined;
    }
  }

  private _acquireTestIdAttribute(attribute: string): void {
    if (Context._testIdAttribute && Context._testIdAttribute !== attribute) {
      throw new Error(
        `Conflicting test-id attributes: ${Context._testIdAttribute} and ${attribute}`
      );
    }
    Context._testIdAttribute = attribute;
    Context._testIdAttributeUsers++;
    selectors.setTestIdAttribute(attribute);
  }

  private async _setupRequestInterception(context: BrowserContext) {
    if (this.config.network.allowedOrigins?.length) {
      await context.route('**', (route) => route.abort('blockedbyclient'));
      await Promise.all(
        this.config.network.allowedOrigins.map((origin) =>
          context.route(`*://${origin}/**`, (route) => route.continue())
        )
      );
    }
    if (this.config.network.blockedOrigins?.length) {
      await Promise.all(
        this.config.network.blockedOrigins.map((origin) =>
          context.route(`*://${origin}/**`, (route) =>
            route.abort('blockedbyclient')
          )
        )
      );
    }
  }

  private _ensureBrowserContext() {
    this._browserContextPromise ??= (() => {
      contextDebug('Ensuring browser context exists');
      const promise = this._setupBrowserContext();
      promise.catch((error) => {
        contextDebug('Failed to setup browser context:', error);
        this._browserContextPromise = undefined;
      });
      return promise;
    })();
    return this._browserContextPromise;
  }

  private async _setupBrowserContext(): Promise<{
    browserContext: BrowserContext;
    close: () => Promise<void>;
    traceDir?: string;
  }> {
    if (this._closeBrowserContextPromise) {
      throw new Error('Another browser context is being closed.');
    }
    const result = await this._browserContextFactory.createContext(
      this._clientInfo,
      this._abortController.signal
    );
    const { browserContext } = result;
    await this._setupRequestInterception(browserContext);
    if (this.sessionLog) {
      await InputRecorder.create(this, browserContext);
    }
    for (const page of browserContext.pages()) {
      this._onPageCreated(page);
    }
    browserContext.on('page', (page) => this._onPageCreated(page));
    if (this.config.saveTrace) {
      await browserContext.tracing.start({
        name: 'trace',
        screenshots: false,
        snapshots: true,
        sources: false,
      });
    }
    return result;
  }
}

export class InputRecorder {
  private readonly context: Context;
  private readonly browserContext: BrowserContext;

  private constructor(context: Context, browserContext: BrowserContext) {
    this.context = context;
    this.browserContext = browserContext;
  }

  static async create(context: Context, browserContext: BrowserContext) {
    const recorder = new InputRecorder(context, browserContext);
    await recorder.initialize();
    return recorder;
  }

  private async initialize() {
    const sessionLog = this.context.sessionLog;
    if (!sessionLog) {
      throw new Error('Session log is required for recorder initialization');
    }
    await (
      this.browserContext as unknown as {
        _enableRecorder: (config: unknown, handlers: unknown) => Promise<void>;
      }
    )._enableRecorder(
      { mode: 'recording', recorderMode: 'api' },
      {
        actionAdded: (
          page: Page,
          data: actions.ActionInContext,
          code: string
        ) => {
          if (this.context.isRunningTool()) {
            return;
          }
          const tab = Tab.forPage(page);
          tab?.context.sessionLog?.logUserAction(data.action, tab, code, false);
        },
        actionUpdated: (
          page: Page,
          data: actions.ActionInContext,
          code: string
        ) => {
          if (this.context.isRunningTool()) {
            return;
          }
          const tab = Tab.forPage(page);
          if (tab) {
            sessionLog.logUserAction(data.action, tab, code, true);
          }
        },
        signalAdded: (page: Page, data: actions.SignalInContext) => {
          if (
            this.context.isRunningTool() ||
            data.signal.name !== 'navigation'
          ) {
            return;
          }
          const tab = Tab.forPage(page);
          if (tab) {
            sessionLog.logUserAction(
              { name: 'navigate', url: data.signal.url, signals: [] },
              tab,
              `await page.goto('${data.signal.url}');`,
              false
            );
          }
        },
      }
    );
  }
}
