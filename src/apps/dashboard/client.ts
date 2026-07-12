import { createClient } from '@modelcontextprotocol/ext-apps';
import {
  clearError,
  firstText,
  parseTabLines,
  renderError,
  renderScreenshot,
  renderTabs,
  type McpContent,
} from './render.js';

const client = createClient();
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
  const content = result.content;
  return Array.isArray(content) ? (content as McpContent[]) : [];
}

const preview = element<HTMLImageElement>('preview');
const tabs = element<HTMLUListElement>('tabs');
const refreshButton = element<HTMLButtonElement>('refresh');
const status = element<HTMLElement>('status');
const error = element<HTMLElement>('error');

async function updatePreview(): Promise<void> {
  const result = await client.callTool('browser_take_screenshot', {
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
    await client.callTool('browser_tab_select', {
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
  const result = await client.callTool('browser_tab_list', {
    expectation: compactExpectation,
  });
  const text = firstText(contentFrom(result));
  renderTabs(document, tabs, parseTabLines(text ?? ''), (index) => {
    void selectTab(index);
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
  void refresh();
});

void refresh();
