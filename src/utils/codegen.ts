// adapted from:
// - https://github.com/microsoft/playwright/blob/76ee48dc9d4034536e3ec5b2c7ce8be3b79418a8/packages/playwright-core/src/utils/isomorphic/stringUtils.ts
// - https://github.com/microsoft/playwright/blob/76ee48dc9d4034536e3ec5b2c7ce8be3b79418a8/packages/playwright-core/src/server/codegen/javascript.ts
// NOTE: this function should not be used to escape any selectors.
export function escapeWithQuotes(
  text: string,
  char: "'" | '"' | '`' = "'"
): string {
  const stringified = JSON.stringify(text);
  if (char === '"') {
    return stringified;
  }
  const body = stringified.slice(1, -1);
  if (char === "'") {
    return `'${body.replaceAll("'", String.raw`\'`)}'`;
  }
  return `\`${body
    .replaceAll('`', String.raw`\``)
    .replaceAll('${', String.raw`\${')}\``;
}

export function quote(text: string): string {
  return escapeWithQuotes(text, "'");
}

export function formatObject(value: unknown, indent = '  '): string {
  if (typeof value === 'string') {
    return quote(value);
  }

  if (Array.isArray(value)) {
    return formatArray(value);
  }

  if (typeof value === 'object' && value !== null) {
    return formatObjectValue(value as Record<string, unknown>, indent);
  }

  return String(value);
}

function formatArray(arr: unknown[]): string {
  return `[${arr.map((o) => formatObject(o)).join(', ')}]`;
}

function formatObjectValue(
  obj: Record<string, unknown>,
  indent: string
): string {
  const keys = getValidObjectKeys(obj);

  if (keys.length === 0) {
    return '{}';
  }

  return buildObjectString(obj, keys, indent);
}

function getValidObjectKeys(obj: Record<string, unknown>): string[] {
  return Object.keys(obj)
    .filter((key) => obj[key] !== undefined)
    .sort((a: string, b: string) =>
      a.localeCompare(b, 'en', { numeric: true })
    );
}

function buildObjectString(
  obj: Record<string, unknown>,
  keys: string[],
  indent: string
): string {
  const tokens = keys.map((key) => `${key}: ${formatObject(obj[key])}`);
  const separator = `,\n${indent}`;
  const tokensJoined = tokens.join(separator);
  return `{\n${indent}${tokensJoined}\n}`;
}