import fs from 'node:fs';
import path from 'node:path';
import type * as actions from './actions.js';
import type { FullConfig } from './config.js';
import { outputFile } from './config.js';
import { OutputManager } from './output-manager.js';
import type { Response } from './response.js';
import type { Tab, TabSnapshot } from './tab.js';
import { logUnhandledError } from './utils/log.js';
import { SecretRedactor } from './utils/secret-redactor.js';

type LogEntry = {
  timestamp: number;
  toolCall?: {
    toolName: string;
    toolArgs: Record<string, unknown>;
    result: string;
    isError?: boolean;
  };
  userAction?: actions.Action;
  code: string;
  tabSnapshot?: TabSnapshot;
};

// Refresh reservations well inside the output manager's ten-minute TTL so
// idle-but-active sessions keep their eviction protection.
const RESERVATION_REFRESH_INTERVAL_MS = 5 * 60_000;

export class SessionLog {
  private readonly _folder: string;
  private readonly _file: string;
  private _pendingEntries: LogEntry[] = [];
  private _sessionFileQueue: Promise<void> = Promise.resolve();
  private _flushEntriesTimeout: NodeJS.Timeout | undefined;
  private _reservationRefreshInterval: NodeJS.Timeout | undefined;
  private _ordinal = 0;
  private readonly _outputManager: OutputManager;
  private readonly _redactor: SecretRedactor;

  constructor(
    sessionFolder: string,
    outputManager: OutputManager,
    redactor: SecretRedactor
  ) {
    this._folder = sessionFolder;
    this._file = path.join(this._folder, 'session.md');
    this._outputManager = outputManager;
    this._redactor = redactor;
  }

  static async create(
    config: FullConfig,
    rootPath: string | undefined
  ): Promise<SessionLog> {
    const sessionFolder = await outputFile(
      config,
      rootPath,
      `session-${Date.now()}`
    );
    await fs.promises.mkdir(sessionFolder, { recursive: true });
    const outputManager = await OutputManager.forDirectory(
      path.dirname(sessionFolder),
      config.outputMaxSize
    );
    // Register the session folder as reserved so quota eviction from other
    // artifacts cannot delete the log while the session is active. A
    // refresh interval keeps the reservation alive for idle sessions past
    // the TTL, and dispose releases it.
    await outputManager.reserveDirectory(sessionFolder);
    const sessionLog = new SessionLog(
      sessionFolder,
      outputManager,
      new SecretRedactor(config.secrets)
    );
    sessionLog._startReservationRefresh();
    return sessionLog;
  }

  private _startReservationRefresh(): void {
    // Refresh well inside the reservation TTL so an idle-but-active session
    // keeps its protection; unref'd so the timer never holds the process.
    this._reservationRefreshInterval = setInterval(() => {
      this._outputManager
        .reserveDirectory(this._folder)
        .catch(logUnhandledError);
    }, RESERVATION_REFRESH_INTERVAL_MS);
    this._reservationRefreshInterval.unref?.();
  }

  logResponse(response: Response) {
    const entry: LogEntry = {
      timestamp: performance.now(),
      toolCall: {
        toolName: response.toolName,
        toolArgs: response.toolArgs,
        result: response.result(),
        isError: response.isError(),
      },
      code: response.code(),
      tabSnapshot: response.tabSnapshot(),
    };
    this._appendEntry(entry);
  }

  logUserAction(
    action: actions.Action | undefined,
    tab: Tab,
    code: string | undefined,
    isUpdate: boolean
  ) {
    if (!action) {
      return;
    }
    const trimmedCode = code?.trim() ?? '';

    if (this._shouldUpdateExistingEntry(action, isUpdate, trimmedCode)) {
      return;
    }

    if (this._shouldSkipDuplicateNavigation(action)) {
      return;
    }

    const entry = this._createUserActionEntry(action, tab, trimmedCode);
    this._appendEntry(entry);
  }

  private _shouldUpdateExistingEntry(
    action: actions.Action,
    isUpdate: boolean,
    trimmedCode: string
  ): boolean {
    if (!isUpdate) {
      return false;
    }

    const lastEntry = this._pendingEntries.at(-1);
    if (lastEntry?.userAction?.name === action.name) {
      lastEntry.userAction = action;
      lastEntry.code = trimmedCode;
      return true;
    }

    return false;
  }

  private _shouldSkipDuplicateNavigation(action: actions.Action): boolean {
    if (action.name !== 'navigate') {
      return false;
    }

    const lastEntry = this._pendingEntries.at(-1);
    return lastEntry?.tabSnapshot?.url === action.url;
  }

  private _createUserActionEntry(
    action: actions.Action,
    tab: Tab,
    trimmedCode: string
  ): LogEntry {
    return {
      timestamp: performance.now(),
      userAction: action,
      code: trimmedCode,
      tabSnapshot: this._createTabSnapshot(action, tab),
    };
  }

  private _createTabSnapshot(action: actions.Action, tab: Tab): TabSnapshot {
    return this._buildTabSnapshotObject(action, tab);
  }

  private _buildTabSnapshotObject(
    action: actions.Action,
    tab: Tab
  ): TabSnapshot {
    return {
      url: tab.page.url(),
      title: '',
      ariaSnapshot: action.ariaSnapshot ?? '',
      modalStates: [],
      consoleMessages: [],
      downloads: [],
    };
  }

  private _appendEntry(entry: LogEntry) {
    this._pendingEntries.push(entry);
    if (this._flushEntriesTimeout) {
      clearTimeout(this._flushEntriesTimeout);
    }
    this._flushEntriesTimeout = setTimeout(() => this._flushEntries(), 1000);
  }

  private _flushEntries() {
    this._executeFlushProcess();
  }

  private _executeFlushProcess(): void {
    this._clearFlushTimeout();
    const { entries, lines } = this._prepareFlushData();
    this._processEntries(entries, lines);
    this._writeToFile(lines);
  }

  private _clearFlushTimeout(): void {
    if (this._flushEntriesTimeout) {
      clearTimeout(this._flushEntriesTimeout);
      this._flushEntriesTimeout = undefined;
    }
  }

  private _prepareFlushData(): { entries: LogEntry[]; lines: string[] } {
    const entries = this._pendingEntries;
    this._pendingEntries = [];
    const lines: string[] = [''];
    return { entries, lines };
  }

  private _processEntries(entries: LogEntry[], lines: string[]): void {
    for (const entry of entries) {
      this._ordinal++;
      const ordinal = this._ordinal.toString().padStart(3, '0');
      this._formatSingleLogEntry(entry, ordinal, lines);
    }
  }

  private _writeToFile(lines: string[]): void {
    this._enqueueFileWrite(async () => {
      await fs.promises.appendFile(this._file, lines.join('\n'));
    });
  }

  private _enqueueFileWrite(operation: () => Promise<void>): void {
    this._sessionFileQueue = this._sessionFileQueue
      .then(operation)
      .catch(logUnhandledError);
  }

  async dispose(): Promise<void> {
    // Stop refreshing before finalizing so no stray reservation re-arms
    // after finalizeDirectory releases this folder's protection.
    if (this._reservationRefreshInterval) {
      clearInterval(this._reservationRefreshInterval);
      this._reservationRefreshInterval = undefined;
    }
    if (this._flushEntriesTimeout) {
      this._flushEntries();
    }
    await this._sessionFileQueue;
    await this._outputManager.finalizeDirectory(this._folder);
  }

  private _formatSingleLogEntry(
    entry: LogEntry,
    ordinal: string,
    lines: string[]
  ): void {
    this._addAllEntryContent(entry, ordinal, lines);
    this._addEntryDelimiters(lines);
  }

  private _addAllEntryContent(
    entry: LogEntry,
    ordinal: string,
    lines: string[]
  ): void {
    this._addToolCallContent(entry, lines);
    this._addUserActionContent(entry, lines);
    this._addCodeContent(entry, lines);
    this._addTabSnapshotContent(entry, ordinal, lines);
  }

  private _addEntryDelimiters(lines: string[]): void {
    lines.push('', '');
  }

  private _addToolCallContent(entry: LogEntry, lines: string[]): void {
    if (!entry.toolCall) {
      return;
    }
    this._addToolCallLines(entry.toolCall, lines);
  }

  private _addUserActionContent(entry: LogEntry, lines: string[]): void {
    if (!entry.userAction) {
      return;
    }
    this._addUserActionLines(entry.userAction, lines);
  }

  private _addCodeContent(entry: LogEntry, lines: string[]): void {
    if (!entry.code) {
      return;
    }
    lines.push('- Code', '```js', this._redact(entry.code), '```');
  }

  private _addTabSnapshotContent(
    entry: LogEntry,
    ordinal: string,
    lines: string[]
  ): void {
    if (!entry.tabSnapshot) {
      return;
    }
    this._addTabSnapshotLines(entry.tabSnapshot, ordinal, lines);
  }

  private _addToolCallLines(
    toolCall: NonNullable<LogEntry['toolCall']>,
    lines: string[]
  ): void {
    this._addToolCallHeader(toolCall, lines);
    this._addToolCallResult(toolCall, lines);
  }

  private _addToolCallHeader(
    toolCall: NonNullable<LogEntry['toolCall']>,
    lines: string[]
  ): void {
    lines.push(
      `### Tool call: ${toolCall.toolName}`,
      '- Args',
      '```json',
      this._redact(JSON.stringify(toolCall.toolArgs, null, 2)),
      '```'
    );
  }

  private _addToolCallResult(
    toolCall: NonNullable<LogEntry['toolCall']>,
    lines: string[]
  ): void {
    if (!toolCall.result) {
      return;
    }
    lines.push(
      toolCall.isError ? '- Error' : '- Result',
      '```',
      this._redact(toolCall.result),
      '```'
    );
  }

  private _addUserActionLines(
    userAction: actions.Action,
    lines: string[]
  ): void {
    const actionData = { ...userAction } as Record<string, unknown>;
    actionData.ariaSnapshot = undefined;
    actionData.selector = undefined;
    actionData.signals = undefined;

    lines.push(
      `### User action: ${userAction.name}`,
      '- Args',
      '```json',
      this._redact(JSON.stringify(actionData, null, 2)),
      '```'
    );
  }

  private _addTabSnapshotLines(
    tabSnapshot: TabSnapshot,
    ordinal: string,
    lines: string[]
  ): void {
    const fileName = `${ordinal}.snapshot.yml`;
    const snapshotPath = path.join(this._folder, fileName);
    const snapshot = this._redact(tabSnapshot.ariaSnapshot);
    this._enqueueFileWrite(async () => {
      await fs.promises.writeFile(snapshotPath, snapshot);
    });
    lines.push(`- Snapshot: ${fileName}`);
  }

  private _redact(value: string): string {
    return this._redactor.redact(value);
  }
}
