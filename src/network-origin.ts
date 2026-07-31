const FULL_ORIGIN_WILDCARD_PORT = /^(https?):\/\/(\[[^\]]+\]|[^/:?#]+):\*$/u;
const HOST_ONLY_PATTERN = /^(\[[^\]]+\]|[^/:?#]+)(?::(?:\d+|\*))?$/u;
const TRAILING_SLASHES_PATTERN = /\/+$/u;

export function originRoutePattern(value: string): string {
  const origin = value.trim().replace(TRAILING_SLASHES_PATTERN, '');
  if (!origin) {
    throw new Error('Network origin must not be empty');
  }

  const wildcardPort = FULL_ORIGIN_WILDCARD_PORT.exec(origin);
  if (wildcardPort) {
    return `${wildcardPort[1]}://${wildcardPort[2]}:*/**`;
  }

  if (!origin.includes('://')) {
    if (!HOST_ONLY_PATTERN.test(origin)) {
      throw new Error(`Invalid network origin: ${value}`);
    }
    return `*://${origin}/**`;
  }

  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error(`Invalid network origin: ${value}`);
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(`Invalid network origin: ${value}`);
  }
  return `${url.origin}/**`;
}
