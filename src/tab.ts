import { EventEmitter } from 'node:events';
import type * as playwright from 'playwright';
import { TIMEOUTS } from './config/constants.js';
import type { Context } from './context.js';
import { ManualPromise } from './manual-promise.js';
import { SelectorResolver } from './services/selector-resolver.js';
import type { ModalState } from './tools/tool.js';
import { waitForCompletion } from './tools/utils.js';
import type { CustomRefOptions } from './types/batch.js';
import type {
  BatchResolutionOptions,
  ElementSelector,
  EnhancedSelectorResult,
  SelectorResolutionResult,
} from './types/selectors.js';
import { logUnhandledError } from './utils/log.js';

// Regex constants

export function isDownloadNavigationError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes('Download is starting')
  );
}

export const TabEvents = {
  modalState: 'modalState',
};
export type TabEventsInterface = {
  [TabEvents.modalState]: [modalState: ModalState];
};

import { snapshotDebug, tabDebug } from './utils/log.js';

export type TabSnapshot = {
  url: string;
  title: string;
  ariaSnapshot: string;
  modalStates: ModalState[];
  consoleMessages: ConsoleMessage[];
  downloads: {
    download: playwright.Download;
    finished: boolean;
    outputFile: string;
  }[];
};
export class Tab extends EventEmitter<TabEventsInterface> {
  readonly context: Context;
  readonly page: playwright.Page;
  private _lastTitle = 'about:blank';
  private readonly _consoleMessages: ConsoleMessage[] = [];
  private _recentConsoleMessages: ConsoleMessage[] = [];
  private readonly _requests: Map<
    playwright.Request,
    playwright.Response | null
  > = new Map();
  private readonly _onPageClose: (tab: Tab) => void;
  private _modalStates: ModalState[] = [];
  private readonly _downloads: {
    download: playwright.Download;
    finished: boolean;
    outputFile: string;
  }[] = [];
  private readonly _customRefMappings: Map<string, string> = new Map();
  private _customRefCounter = 0;
  private readonly _selectorResolver: SelectorResolver;
  private readonly _navigationState: {
    isNavigating: boolean;
    lastNavigationStart: number;
    navigationPromise?: Promise<void>;
  } = {
    isNavigating: false,
    lastNavigationStart: 0,
  };
  constructor(
    context: Context,
    page: playwright.Page,
    onPageClose: (tab: Tab) => void
  ) {
    super();
    this.context = context;
    this.page = page;
    this._onPageClose = onPageClose;
    this._selectorResolver = new SelectorResolver(page);
    page.on('console', (event) =>
      this._handleConsoleMessage(messageToConsoleMessage(event))
    );
    page.on('pageerror', (error) =>
      this._handleConsoleMessage(pageErrorToConsoleMessage(error))
    );
    page.on('request', (request) => this._requests.set(request, null));
    page.on('response', (response) =>
      this._requests.set(response.request(), response)
    );
    page.on('close', () => this._onClose());
    page.on('filechooser', (chooser) => {
      this.setModalState({
        type: 'fileChooser',
        description: 'File chooser',
        fileChooser: chooser,
      });
    });
    page.on('dialog', (dialog) => this._dialogShown(dialog));
    page.on('dialogclosed', (dialog) => this._dialogClosed(dialog));
    page.on('download', (download) => {
      this._downloadStarted(download).catch((error) => {
        // Intentionally ignore download errors to prevent crashing
        tabDebug('Download error ignored:', error);
      });
    });

    // Navigation state tracking
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) {
        this._handleNavigationStart();
      }
    });
    page.on('load', () => {
      this._handleNavigationComplete();
    });
    page.on('domcontentloaded', () => {
      // DOMContentLoaded is the cross-browser operational boundary.
      this._handleNavigationComplete();
    });

    const configuredTimeouts = context.config?.timeouts;
    page.setDefaultNavigationTimeout(configuredTimeouts?.navigation ?? 60_000);
    page.setDefaultTimeout(configuredTimeouts?.action ?? 5000);
    (page as { [tabSymbol]?: Tab })[tabSymbol] = this;
  }
  static forPage(page: playwright.Page): Tab | undefined {
    return (page as { [tabSymbol]?: Tab })[tabSymbol];
  }
  modalStates(): ModalState[] {
    return this._modalStates;
  }
  setModalState(modalState: ModalState) {
    this._modalStates.push(modalState);
    this.emit(TabEvents.modalState, modalState);
  }
  clearModalState(modalState: ModalState) {
    this._modalStates = this._modalStates.filter(
      (state) => state !== modalState
    );
  }
  modalStatesMarkdown(): string[] {
    return renderModalStates(this.context, this.modalStates());
  }
  private _dialogShown(dialog: playwright.Dialog) {
    this.setModalState({
      type: 'dialog',
      description: `"${dialog.type()}" dialog with message "${dialog.message()}"`,
      dialog,
    });
  }

  private _dialogClosed(dialog: playwright.Dialog) {
    this._modalStates = this._modalStates.filter(
      (state) => state.type !== 'dialog' || state.dialog !== dialog
    );
  }
  private async _downloadStarted(download: playwright.Download) {
    const entry = {
      download,
      finished: false,
      outputFile: await this.context.outputFile(download.suggestedFilename()),
    };
    this._downloads.push(entry);
    await download.saveAs(entry.outputFile);
    await this.context.finalizeOutputFile(entry.outputFile);
    entry.finished = true;
  }
  private _clearCollectedArtifacts() {
    this._consoleMessages.length = 0;
    this._recentConsoleMessages.length = 0;
    this._requests.clear();
  }
  private _handleConsoleMessage(message: ConsoleMessage) {
    this._consoleMessages.push(message);
    this._recentConsoleMessages.push(message);
  }
  private _onClose() {
    this._clearCollectedArtifacts();
    this._onPageClose(this);
  }
  async updateTitle() {
    await this._raceAgainstModalStates(async () => {
      this._lastTitle = await this.page.title();
    });
  }
  lastTitle(): string {
    return this._lastTitle;
  }
  isCurrentTab(): boolean {
    return this === this.context.currentTab();
  }
  async waitForLoadState(
    state: 'load' | 'networkidle',
    options?: { timeout?: number }
  ): Promise<void> {
    tabDebug(`Waiting for load state: ${state}`);
    await this.page.waitForLoadState(state, options).catch((error) => {
      tabDebug(`Failed to wait for load state ${state}:`, error);
      logUnhandledError(error);
    });
  }

  /**
   * Navigation state management methods
   */
  private _handleNavigationStart(): void {
    this._navigationState.isNavigating = true;
    this._navigationState.lastNavigationStart = Date.now();

    // Create a promise that resolves when navigation completes
    this._navigationState.navigationPromise = this._createNavigationPromise();
  }

  private _handleNavigationComplete(): void {
    this._navigationState.isNavigating = false;
  }

  private _createNavigationPromise(): Promise<void> {
    return new Promise<void>((resolve) => {
      const checkComplete = () => {
        if (!this._navigationState.isNavigating) {
          resolve();
          return;
        }

        // Timeout after configured duration
        if (
          Date.now() - this._navigationState.lastNavigationStart >
          (this.context.config.timeouts?.navigation ?? 60_000)
        ) {
          this._navigationState.isNavigating = false;
          resolve();
          return;
        }

        setTimeout(checkComplete, NAVIGATION_CHECK_INTERVAL);
      };

      setTimeout(checkComplete, NAVIGATION_CHECK_INTERVAL);
    });
  }

  /**
   * Check if navigation is currently in progress
   */
  isNavigating(): boolean {
    // Consider stale if navigation started more than configured timeout ago
    const isStale =
      Date.now() - this._navigationState.lastNavigationStart >
      (this.context.config.timeouts?.navigation ?? 60_000);
    if (isStale && this._navigationState.isNavigating) {
      this._navigationState.isNavigating = false;
    }

    return this._navigationState.isNavigating;
  }

  /**
   * Wait for current navigation to complete (if any)
   */
  async waitForNavigationComplete(): Promise<void> {
    if (this._navigationState.navigationPromise) {
      await this._navigationState.navigationPromise;
    }
  }

  async navigate(url: string) {
    tabDebug(`Navigating to: ${url}`);
    this._clearCollectedArtifacts();
    const downloadEvent = new ManualPromise<playwright.Download | undefined>();
    let downloadTimer: NodeJS.Timeout | undefined;
    const onDownload = (download: playwright.Download) => {
      if (downloadTimer) {
        clearTimeout(downloadTimer);
        downloadTimer = undefined;
      }
      this.page.off('download', onDownload);
      if (!downloadEvent.isDone()) {
        downloadEvent.resolve(download);
      }
    };
    const abortDownloadWaiter = () => {
      if (downloadTimer) {
        clearTimeout(downloadTimer);
        downloadTimer = undefined;
      }
      this.page.off('download', onDownload);
      if (!downloadEvent.isDone()) {
        downloadEvent.resolve(undefined);
      }
    };
    this.page.on('download', onDownload);
    downloadTimer = setTimeout(abortDownloadWaiter, TIMEOUTS.LONG_DELAY);

    try {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' });
      abortDownloadWaiter();
    } catch (_e: unknown) {
      const e = _e as Error;
      if (!isDownloadNavigationError(e)) {
        abortDownloadWaiter();
        throw e;
      }
      // On Chromium, the download event can arrive after page.goto rejects.
      const download = await downloadEvent;
      if (!download) {
        throw e;
      }
      // Make sure other "download" listeners are notified first.
      await new Promise((resolve) => setTimeout(resolve, TIMEOUTS.SHORT_DELAY));
      return;
    }
    // DOMContentLoaded is the cross-browser operational boundary.
  }
  consoleMessages(): ConsoleMessage[] {
    return this._consoleMessages;
  }
  requests(): Map<playwright.Request, playwright.Response | null> {
    return this._requests;
  }
  async captureSnapshot(): Promise<TabSnapshot> {
    return await this._captureSnapshotInternal();
  }
  async capturePartialSnapshot(
    selector?: string,
    maxLength?: number
  ): Promise<TabSnapshot> {
    return await this._captureSnapshotInternal(selector, maxLength);
  }
  async captureAriaSnapshot(): Promise<string> {
    let ariaSnapshot = '';
    await this._raceAgainstModalStates(async () => {
      ariaSnapshot = await this.page.ariaSnapshot({ mode: 'ai' });
    });
    return ariaSnapshot;
  }
  private async _captureSnapshotInternal(
    selector?: string,
    maxLength?: number
  ): Promise<TabSnapshot> {
    const result: TabSnapshot = {
      url: this.page.url(),
      title: await this.page.title(),
      ariaSnapshot: '',
      modalStates: this.modalStates(),
      consoleMessages: this._recentConsoleMessages,
      downloads: this._downloads,
    };
    // Console messages are consumed immediately after collecting them
    this._recentConsoleMessages = [];
    await this._raceAgainstModalStates(async () => {
      let ariaSnapshot: string;
      if (selector) {
        const locator = this.page.locator(selector);
        if (await locator.count()) {
          ariaSnapshot = await locator.first().ariaSnapshot({ mode: 'ai' });
        } else {
          snapshotDebug(
            'Selector "%s" not found, returning full snapshot',
            selector
          );
          ariaSnapshot = await this.page.ariaSnapshot({ mode: 'ai' });
        }
      } else {
        ariaSnapshot = await this.page.ariaSnapshot({ mode: 'ai' });
      }
      // Apply maxLength truncation if specified
      if (maxLength && ariaSnapshot.length > maxLength) {
        ariaSnapshot = this._truncateAtWordBoundary(ariaSnapshot, maxLength);
      }
      result.ariaSnapshot = ariaSnapshot;
    });
    return result;
  }
  private _truncateAtWordBoundary(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    // Look for the last word boundary before maxLength
    let truncateIndex = maxLength;
    // Check if we're in the middle of a word at maxLength
    if (
      text[maxLength] &&
      text[maxLength] !== ' ' &&
      text[maxLength] !== '\n'
    ) {
      // We're in the middle of a word, find the last space before maxLength
      for (let i = maxLength - 1; i >= 0; i--) {
        if (text[i] === ' ' || text[i] === '\n') {
          truncateIndex = i;
          break;
        }
      }
      // If we've gone back too far (more than 20 chars), just cut at maxLength
      if (maxLength - truncateIndex > 20) {
        truncateIndex = maxLength;
      }
    }
    let result = text.substring(0, truncateIndex).trim();
    // Ensure the result doesn't exceed maxLength after trimming
    if (result.length > maxLength) {
      result = result.substring(0, maxLength);
    }
    return result;
  }
  private _javaScriptBlocked(): boolean {
    return this._modalStates.some((state) => state.type === 'dialog');
  }
  private async _raceAgainstModalStates(
    action: () => Promise<void>
  ): Promise<ModalState[]> {
    if (this.modalStates().length) {
      return this.modalStates();
    }
    const promise = new ManualPromise<ModalState[]>();
    const listener = (modalState: ModalState) => promise.resolve([modalState]);
    this.once(TabEvents.modalState, listener);
    return await Promise.race([
      action().then(() => {
        this.off(TabEvents.modalState, listener);
        return [];
      }),
      promise,
    ]);
  }
  async waitForCompletion(callback: () => Promise<void>) {
    await this._raceAgainstModalStates(() => waitForCompletion(this, callback));
  }
  registerCustomRef(ref: string, selector: string): void {
    this._customRefMappings.set(ref, selector);
  }

  unregisterCustomRef(ref: string): void {
    this._customRefMappings.delete(ref);
  }

  clearCustomRefs(): void {
    this._customRefMappings.clear();
  }

  getNextCustomRefId(options?: CustomRefOptions): string {
    this._customRefCounter++;

    if (options?.batchId && options.batchId.length > 0) {
      return `batch_${options.batchId}_element_${this._customRefCounter}`;
    }

    return `element_${this._customRefCounter}`;
  }

  /**
   * Resolve multiple element selectors using the new unified selector system
   */
  async resolveElementLocators(
    selectors: ElementSelector[],
    options?: BatchResolutionOptions
  ): Promise<SelectorResolutionResult[]> {
    tabDebug(`Resolving ${selectors.length} element locators`);
    try {
      return await this._selectorResolver.resolveSelectors(selectors, options);
    } catch (error) {
      tabDebug('Failed to resolve element locators:', error);
      throw error;
    }
  }

  /**
   * Resolve a single element selector with enhanced metadata
   */
  async resolveSingleElementLocator(
    selector: ElementSelector,
    options?: { timeoutMs?: number }
  ): Promise<EnhancedSelectorResult> {
    tabDebug('Resolving single element locator:', selector);
    try {
      return await this._selectorResolver.resolveSingleSelector(
        selector,
        options
      );
    } catch (error) {
      tabDebug('Failed to resolve single element locator:', error);
      throw error;
    }
  }

  /**
   * Resolve a single selector to a Playwright locator
   */
  async refLocator(params: {
    element: string;
    selector: ElementSelector;
  }): Promise<playwright.Locator> {
    const { selector } = params;

    tabDebug('Using selector system for element:', params.element);
    const result = await this._selectorResolver.resolveSingleSelector(selector);

    if (result.error || !result.locator) {
      const errorMessage = `Failed to resolve selector for element "${params.element}": ${result.error || 'Unknown error'}`;
      const alternativesMessage = result.alternatives
        ? `. Alternatives: ${JSON.stringify(result.alternatives)}`
        : '';
      throw new Error(errorMessage + alternativesMessage);
    }

    return result.locator.describe(params.element);
  }

  /**
   * Enhanced refLocators method supporting mixed legacy and new selector formats
   */
  async refLocators(
    params: Array<{
      element: string;
      selector: ElementSelector;
    }>
  ): Promise<playwright.Locator[]> {
    const selectors = params.map((p) => {
      if (!p.selector) {
        throw new Error(`Missing selector for element: ${p.element}`);
      }
      return p.selector;
    });

    const resolutionResults =
      await this._selectorResolver.resolveSelectors(selectors);

    const results: playwright.Locator[] = [];
    for (let i = 0; i < resolutionResults.length; i++) {
      const result = resolutionResults[i];
      const param = params[i];

      if (result.error || !result.locator) {
        const errorMessage = `Failed to resolve selector for element "${param.element}": ${result.error || 'Unknown error'}`;
        const alternativesMessage = result.alternatives
          ? `. Alternatives: ${JSON.stringify(result.alternatives)}`
          : '';
        throw new Error(errorMessage + alternativesMessage);
      }

      results.push(result.locator.describe(param.element));
    }

    return results;
  }

  async waitForTimeout(time: number) {
    if (this._javaScriptBlocked()) {
      await new Promise((f) => setTimeout(f, time));
      return;
    }
    await this.page.evaluate(
      (timeout) => new Promise((resolve) => setTimeout(resolve, timeout)),
      time
    );
  }
}
export type ConsoleMessage = {
  type: ReturnType<playwright.ConsoleMessage['type']> | undefined;
  text: string;
  toString(): string;
};
function messageToConsoleMessage(
  message: playwright.ConsoleMessage
): ConsoleMessage {
  return {
    type: message.type(),
    text: message.text(),
    toString: () =>
      `[${message.type().toUpperCase()}] ${message.text()} @ ${
        message.location().url
      }:${message.location().lineNumber}`,
  };
}
function pageErrorToConsoleMessage(error: Error): ConsoleMessage {
  return {
    type: undefined,
    text: error.message,
    toString: () => error.stack ?? error.message,
  };
}
export function renderModalStates(
  context: Context,
  modalStates: ModalState[]
): string[] {
  const result: string[] = ['### Modal state'];
  if (modalStates.length === 0) {
    result.push('- There is no modal state present');
  }
  for (const state of modalStates) {
    const tool = context.tools
      .filter((t) => 'clearsModalState' in t)
      .find((t) => t.clearsModalState === state.type);
    result.push(
      `- [${state.description}]: can be handled by the "${tool?.schema.name}" tool`
    );
  }
  return result;
}
const tabSymbol = Symbol('tabSymbol');

const NAVIGATION_CHECK_INTERVAL = 100;
