const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:']);

function stripTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) {
    end--;
  }
  return value.slice(0, end);
}

function assertSupportedOrigin(url: URL, original: string): void {
  if (
    !SUPPORTED_PROTOCOLS.has(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    !url.hostname
  ) {
    throw new Error(`Invalid network origin: ${original}`);
  }
}

function fullOriginWildcardPattern(
  origin: string,
  schemeSeparator: number,
  original: string
): string | undefined {
  if (!origin.endsWith(':*')) {
    return;
  }
  const protocol = `${origin.slice(0, schemeSeparator)}:`;
  if (!SUPPORTED_PROTOCOLS.has(protocol)) {
    throw new Error(`Invalid network origin: ${original}`);
  }
  const authority = origin.slice(schemeSeparator + 3, -2);
  if (!authority) {
    throw new Error(`Invalid network origin: ${original}`);
  }
  try {
    const parsed = new URL(`${protocol}//${authority}:1`);
    assertSupportedOrigin(parsed, original);
    if (parsed.port !== '1') {
      throw new Error(`Invalid network origin: ${original}`);
    }
  } catch {
    throw new Error(`Invalid network origin: ${original}`);
  }
  return `${protocol}//${authority}:*/**`;
}

function hostOnlyRoutePattern(origin: string, original: string): string {
  const wildcardPort = origin.endsWith(':*');
  const candidate = wildcardPort ? `${origin.slice(0, -2)}:1` : origin;
  try {
    const parsed = new URL(`http://${candidate}`);
    assertSupportedOrigin(parsed, original);
    if (wildcardPort && parsed.port !== '1') {
      throw new Error(`Invalid network origin: ${original}`);
    }
  } catch {
    throw new Error(`Invalid network origin: ${original}`);
  }
  return `*://${origin}/**`;
}

export function originRoutePattern(value: string): string {
  const origin = stripTrailingSlashes(value.trim());
  if (!origin) {
    throw new Error('Network origin must not be empty');
  }

  const schemeSeparator = origin.indexOf('://');
  if (schemeSeparator === -1) {
    return hostOnlyRoutePattern(origin, value);
  }

  const wildcard = fullOriginWildcardPattern(origin, schemeSeparator, value);
  if (wildcard) {
    return wildcard;
  }

  try {
    const parsed = new URL(origin);
    assertSupportedOrigin(parsed, value);
    return `${parsed.origin}/**`;
  } catch {
    throw new Error(`Invalid network origin: ${value}`);
  }
}
