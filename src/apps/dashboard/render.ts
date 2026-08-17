export type TabEntry = {
  index: number;
  label: string;
};

export type McpContent = {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
};

const TAB_LINE_PREFIX = '-';
const TAB_INDEX_PATTERN = /^\d+$/u;
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function parseTabLine(line: string): TabEntry | undefined {
  const trimmed = line.trim();
  if (!trimmed.startsWith(TAB_LINE_PREFIX)) {
    return;
  }
  const separator = trimmed.indexOf(':');
  if (separator <= 1) {
    return;
  }
  const indexText = trimmed.slice(1, separator).trim();
  const label = trimmed.slice(separator + 1).trim();
  if (!(TAB_INDEX_PATTERN.test(indexText) && label)) {
    return;
  }
  const index = Number(indexText);
  return Number.isSafeInteger(index) ? { index, label } : undefined;
}

export function parseTabLines(text: string): TabEntry[] {
  return text
    .split('\n')
    .map((line) => parseTabLine(line))
    .filter((entry): entry is TabEntry => Boolean(entry));
}

export function renderTabs(
  document: Document,
  container: HTMLElement,
  entries: readonly TabEntry[],
  selectTab: (index: number) => void
): void {
  if (entries.length === 0) {
    const item = document.createElement('li');
    item.textContent = 'No open tabs found.';
    container.replaceChildren(item);
    return;
  }

  container.replaceChildren(
    ...entries.map((entry) => {
      const item = document.createElement('li');
      const label = document.createElement('span');
      label.textContent = entry.label;
      label.className = 'tab-label';
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `Select tab ${entry.index}`;
      button.addEventListener('click', () => selectTab(entry.index));
      item.append(label, button);
      return item;
    })
  );
}

export function renderError(element: HTMLElement, message: string): void {
  element.textContent = message;
  element.hidden = false;
}

export function clearError(element: HTMLElement): void {
  element.textContent = '';
  element.hidden = true;
}

export function renderScreenshot(
  image: HTMLImageElement,
  content: readonly McpContent[]
): boolean {
  const part = content.find(
    (candidate) =>
      candidate.type === 'image' &&
      typeof candidate.data === 'string' &&
      typeof candidate.mimeType === 'string' &&
      ALLOWED_IMAGE_TYPES.has(candidate.mimeType)
  );
  if (!(part?.data && part.mimeType)) {
    image.removeAttribute('src');
    image.hidden = true;
    return false;
  }
  image.src = `data:${part.mimeType};base64,${part.data}`;
  image.hidden = false;
  return true;
}

export function firstText(content: readonly McpContent[]): string | undefined {
  return content.find(
    (candidate) =>
      candidate.type === 'text' && typeof candidate.text === 'string'
  )?.text;
}

export function isErrorResult(result: unknown): boolean {
  return (
    !!result &&
    typeof result === 'object' &&
    'isError' in result &&
    Boolean((result as { isError?: unknown }).isError)
  );
}
