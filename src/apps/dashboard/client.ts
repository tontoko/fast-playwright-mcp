import { App } from '@modelcontextprotocol/ext-apps';
import { refreshDashboard } from './refresh.js';
import {
  clearError,
  firstText,
  isErrorResult,
  type McpContent,
  parseTabLines,
  renderError,
  renderScreenshot,
  renderTabs,
} from './render.js';

const app = new App({ name: 'Browser dashboard', version: '1.0.0' });
const compactExpectation = {
  includeSnapshot: false,
  includeTabs: false,
  includeCode: false,
  includeConsole: false,
};

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) {
    throw new Error(`Dashboard element not found: ${id}`);
  }
  return value as T;
}

function contentFrom(result: unknown): McpContent[] {
  if (!result || typeof result !== 'object' || !('content' in result)) {
    return [];
  }
  return Array.isArray(result.content) ? (result.content as McpContent[]) : [];
}

async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  const result = await app.callServerTool({ name, arguments: args });
  // A normal MCP error result (e.g. the browser disconnected or a stale tab
  // index) resolves instead of rejecting; surface it so the dashboard shows
  // the failure instead of reporting stale state as current.
  if (isErrorResult(result)) {
    throw new Error(
      firstText(contentFrom(result)) || `Tool ${name} returned an error`
    );
  }
  return result;
}

const preview = element<HTMLImageElement>('preview');
const tabs = element<HTMLUListElement>('tabs');
const refreshButton = element<HTMLButtonElement>('refresh');
const status = element<HTMLElement>('status');
const error = element<HTMLElement>('error');

async function updatePreview(): Promise<boolean> {
  const result = await callTool('browser_take_screenshot', {
    type: 'jpeg',
    expectation: compactExpectation,
  });
  return renderScreenshot(preview, contentFrom(result));
}

async function selectTab(index: number): Promise<void> {
  clearError(error);
  status.textContent = `Selecting tab ${index}…`;
  try {
    await callTool('browser_tab_select', {
      index,
      expectation: compactExpectation,
    });
    await refresh();
  } catch (cause) {
    renderError(
      error,
      `Failed to select tab: ${
        cause instanceof Error ? cause.message : String(cause)
      }`
    );
  }
}

async function updateTabs(): Promise<void> {
  const result = await callTool('browser_tab_list', {
    expectation: compactExpectation,
  });
  const text = firstText(contentFrom(result));
  renderTabs(document, tabs, parseTabLines(text ?? ''), (index) => {
    selectTab(index).catch((cause) => {
      renderError(error, `Failed to select tab: ${String(cause)}`);
    });
  });
}

async function refresh(): Promise<void> {
  clearError(error);
  refreshButton.disabled = true;
  status.textContent = 'Refreshing browser state…';
  try {
    const { previewAvailable } = await refreshDashboard({
      updateTabs,
      updatePreview,
    });
    status.textContent = previewAvailable
      ? 'Browser state is up to date.'
      : 'Browser state is up to date; image preview is disabled.';
  } catch (cause) {
    renderError(
      error,
      `Refresh failed: ${cause instanceof Error ? cause.message : String(cause)}`
    );
    status.textContent = 'Refresh failed.';
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener('click', () => {
  refresh().catch((cause) => {
    renderError(error, `Refresh failed: ${String(cause)}`);
  });
});

app.onerror = (cause) => {
  renderError(
    error,
    `MCP Apps connection error: ${
      cause instanceof Error ? cause.message : String(cause)
    }`
  );
};

await app.connect();
await refresh();
