/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { debugLog, RelayConnection } from './relay-connection.js';

type PageMessage =
  | {
      type: 'connectToMCPRelay';
      mcpRelayUrl: string;
    }
  | {
      type: 'getTabs';
    }
  | {
      type: 'connectToTab';
      tabId: number;
      windowId: number;
      mcpRelayUrl: string;
    }
  | {
      type: 'rejectConnection';
    }
  | {
      type: 'getConnectionStatus';
    }
  | {
      type: 'disconnect';
    };

class TabShareExtension {
  private _activeConnection: RelayConnection | undefined;
  private _connectedTabId: number | null = null;
  private readonly _pendingTabSelection = new Map<
    number,
    { connection: RelayConnection; timerId?: number }
  >();

  constructor() {
    chrome.tabs.onRemoved.addListener(this._onTabRemoved.bind(this));
    chrome.tabs.onUpdated.addListener(this._onTabUpdated.bind(this));
    chrome.tabs.onActivated.addListener(this._onTabActivated.bind(this));
    chrome.runtime.onMessage.addListener(this._onMessage.bind(this));
    chrome.action.onClicked.addListener(this._onActionClicked.bind(this));
  }

  // Promise-based message handling is not supported in Chrome: https://issues.chromium.org/issues/40753031
  private _onMessage(
    message: PageMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: {
      success: boolean;
      error?: string;
      tabs?: chrome.tabs.Tab[];
      currentTabId?: number;
      connectedTabId?: number | null;
    }) => void
  ) {
    switch (message.type) {
      case 'connectToMCPRelay':
        if (!(sender.tab?.id && message.mcpRelayUrl)) {
          sendResponse({
            success: false,
            error: 'Missing tab ID or relay URL',
          });
          return false;
        }
        this._connectToRelay(sender.tab.id, message.mcpRelayUrl).then(
          () => sendResponse({ success: true }),
          (error: unknown) =>
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            })
        );
        return true;
      case 'getTabs':
        this._getTabs().then(
          (tabs) =>
            sendResponse({ success: true, tabs, currentTabId: sender.tab?.id }),
          (error: unknown) =>
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            })
        );
        return true;
      case 'connectToTab':
        if (!(sender.tab?.id && message.mcpRelayUrl)) {
          sendResponse({
            success: false,
            error: 'Missing tab ID or relay URL',
          });
          return false;
        }
        this._connectTab(
          sender.tab.id,
          message.tabId,
          message.windowId,
          message.mcpRelayUrl
        ).then(
          () => sendResponse({ success: true }),
          (error: unknown) =>
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            })
        );
        return true; // Return true to indicate that the response will be sent asynchronously
      case 'rejectConnection':
        if (!sender.tab?.id) {
          sendResponse({ success: false, error: 'Missing tab ID' });
          return false;
        }
        this._closePendingConnection(
          sender.tab.id,
          'Connection rejected by user'
        );
        sendResponse({ success: true });
        return false;
      case 'getConnectionStatus':
        sendResponse({
          success: true,
          connectedTabId: this._connectedTabId,
        });
        return false;
      case 'disconnect':
        this._disconnect().then(
          () => sendResponse({ success: true }),
          (error: unknown) =>
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            })
        );
        return true;
      default:
        // Handle unexpected message types
        sendResponse({
          success: false,
          error: `Unknown message type: ${(message as { type: string }).type}`,
        });
        return false;
    }
  }

  private async _connectToRelay(
    selectorTabId: number,
    mcpRelayUrl: string
  ): Promise<void> {
    const socket = new WebSocket(mcpRelayUrl);
    let timeoutId: number | undefined;
    try {
      debugLog(`Connecting to relay at ${mcpRelayUrl}`);
      await new Promise<void>((resolve, reject) => {
        const finish = (callback: () => void) => {
          if (timeoutId !== undefined) {
            clearTimeout(timeoutId);
            timeoutId = undefined;
          }
          callback();
        };
        socket.onopen = () => finish(resolve);
        socket.onerror = () =>
          finish(() => reject(new Error('WebSocket error')));
        timeoutId = setTimeout(() => {
          socket.close();
          reject(new Error('Connection timeout'));
        }, 5000);
      });

      const connection = new RelayConnection(socket);
      const pending = { connection } as {
        connection: RelayConnection;
        timerId?: number;
      };
      const previous = this._pendingTabSelection.get(selectorTabId);
      this._pendingTabSelection.set(selectorTabId, pending);
      connection.onclose = () => {
        if (
          this._pendingTabSelection.get(selectorTabId)?.connection !==
          connection
        ) {
          return;
        }
        this._pendingTabSelection.delete(selectorTabId);
        chrome.tabs
          .sendMessage(selectorTabId, { type: 'pendingConnectionClosed' })
          .catch(() => {
            // The selector tab may already be closed.
          });
      };
      if (previous) {
        if (previous.timerId !== undefined) {
          clearTimeout(previous.timerId);
        }
        previous.connection.close('A newer connection was requested');
      }
      debugLog('Connected to MCP relay');
    } catch (error: unknown) {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
      socket.close();
      debugLog(
        'Failed to connect to MCP relay:',
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private async _connectTab(
    selectorTabId: number,
    tabId: number,
    windowId: number,
    mcpRelayUrl: string
  ): Promise<void> {
    try {
      debugLog(`Connecting tab ${tabId} to relay at ${mcpRelayUrl}`);
      try {
        this._activeConnection?.close('Another connection is requested');
      } catch (error: unknown) {
        debugLog('Error closing active connection:', error);
      }
      await this._setConnectedTabId(null);

      const pending = this._pendingTabSelection.get(selectorTabId);
      if (!pending) {
        throw new Error('No active MCP relay connection');
      }
      this._pendingTabSelection.delete(selectorTabId);
      if (pending.timerId !== undefined) {
        clearTimeout(pending.timerId);
      }

      const activeConnection = pending.connection;
      this._activeConnection = activeConnection;
      activeConnection.setTabId(tabId);
      activeConnection.onclose = () => {
        if (this._activeConnection !== activeConnection) {
          return;
        }
        debugLog('MCP connection closed');
        this._activeConnection = undefined;
        this._setConnectedTabId(null).catch(() => {
          // Ignore errors during cleanup
        });
      };

      await Promise.all([
        this._setConnectedTabId(tabId),
        chrome.tabs.update(tabId, { active: true }),
        chrome.windows.update(windowId, { focused: true }),
      ]);
      debugLog('Connected to MCP bridge');
    } catch (error: unknown) {
      await this._setConnectedTabId(null);
      debugLog(
        `Failed to connect tab ${tabId}:`,
        error instanceof Error ? error.message : String(error)
      );
      throw error;
    }
  }

  private async _setConnectedTabId(tabId: number | null): Promise<void> {
    const oldTabId = this._connectedTabId;
    this._connectedTabId = tabId;
    if (oldTabId && oldTabId !== tabId) {
      await this._updateBadge(oldTabId, { text: '' });
    }
    if (tabId) {
      await this._updateBadge(tabId, {
        text: '✓',
        color: '#4CAF50',
        title: 'Connected to MCP client',
      });
    }
  }

  private async _updateBadge(
    tabId: number,
    { text, color, title }: { text: string; color?: string; title?: string }
  ): Promise<void> {
    try {
      await chrome.action.setBadgeText({ tabId, text });
      await chrome.action.setTitle({ tabId, title: title || '' });
      if (color) {
        await chrome.action.setBadgeBackgroundColor({ tabId, color });
      }
    } catch (error: unknown) {
      // Log errors as the tab may be closed already, but still track the issue
      debugLog(
        'Failed to update badge:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  private _closePendingConnection(
    selectorTabId: number,
    reason: string
  ): boolean {
    const pending = this._pendingTabSelection.get(selectorTabId);
    if (!pending) {
      return false;
    }
    this._pendingTabSelection.delete(selectorTabId);
    if (pending.timerId !== undefined) {
      clearTimeout(pending.timerId);
    }
    pending.connection.close(reason);
    return true;
  }

  private _onTabRemoved(tabId: number): void {
    if (this._closePendingConnection(tabId, 'Browser tab closed')) {
      return;
    }
    if (this._connectedTabId !== tabId) {
      return;
    }
    this._activeConnection?.close('Browser tab closed');
    this._activeConnection = undefined;
    this._connectedTabId = null;
  }

  private _onTabActivated(activeInfo: chrome.tabs.TabActiveInfo) {
    for (const [tabId, pending] of this._pendingTabSelection) {
      if (tabId === activeInfo.tabId) {
        if (pending.timerId !== undefined) {
          clearTimeout(pending.timerId);
          pending.timerId = undefined;
        }
        continue;
      }
      if (pending.timerId !== undefined) {
        continue;
      }
      pending.timerId = setTimeout(() => {
        if (this._pendingTabSelection.get(tabId) !== pending) {
          return;
        }
        this._pendingTabSelection.delete(tabId);
        pending.connection.close('Tab has been inactive for 5 seconds');
        chrome.tabs
          .sendMessage(tabId, { type: 'connectionTimeout' })
          .catch(() => {
            // The selector tab may already be closed.
          });
      }, 5000);
    }
  }

  private _onTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    _tab: chrome.tabs.Tab
  ) {
    if (changeInfo.status === 'complete' && this._connectedTabId === tabId) {
      this._setConnectedTabId(tabId).catch(() => {
        // Ignore errors during badge update
      });
    }
  }

  private async _getTabs(): Promise<chrome.tabs.Tab[]> {
    const tabs = await chrome.tabs.query({});
    return tabs.filter(
      (tab) =>
        tab.url &&
        !['chrome:', 'edge:', 'devtools:'].some((scheme) =>
          tab.url?.startsWith(scheme)
        )
    );
  }

  private async _onActionClicked(): Promise<void> {
    await chrome.tabs.create({
      url: chrome.runtime.getURL('status.html'),
      active: true,
    });
  }

  private async _disconnect(): Promise<void> {
    this._activeConnection?.close('User disconnected');
    this._activeConnection = undefined;
    for (const tabId of [...this._pendingTabSelection.keys()]) {
      this._closePendingConnection(tabId, 'User disconnected');
    }
    await this._setConnectedTabId(null);
  }
}

const _tabShareExtension = new TabShareExtension();
// Extension instance is intentionally kept in scope for lifecycle management
