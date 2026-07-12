import { App } from '@modelcontextprotocol/ext-apps';
import {
  clearError,
  firstText,
  parseTabLines,
  renderError,
  renderScreenshot,
  renderTabs,
  type McpContent,
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
  return Array.isArray(result.content)
    ? (result.content as McpContent[])
    : [];
}

function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  return app.callServerTool({ name, arguments: args });
}

const preview = element<HTMLImageElement>('preview');
const tabs = element<HTMLUListElement>('tabs');
const refreshButton = element<HTMLButtonElement>('refresh');
const status = element<HTMLElement>('status');
const error = element<HTMLElement>('error');

async function updatePreview(): Promise<void> {
  const result = await callTool('browser_take_screenshot', {
    type: 'jpeg',
    expectation: compactExpectation,
  });
  if (!renderScreenshot(preview, contentFrom(result))) {
    throw new Error('Screenshot tool did not return a supported image.');
  }
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
    await Promise.all([updatePreview(), updateTabs()]);
    status.textContent = 'Browser state is up to date.';
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
