import assert from 'node:assert/strict';
import http from 'node:http';
import { type AddressInfo, isIP } from 'node:net';

export async function startHttpServer(config: {
  host?: string;
  port?: number;
}): Promise<http.Server> {
  const { host, port } = config;
  const httpServer = http.createServer();
  await new Promise<void>((resolve, reject) => {
    httpServer.on('error', reject);
    httpServer.listen(port, host, () => {
      resolve();
      httpServer.removeListener('error', reject);
    });
  });
  return httpServer;
}

export function httpAddressToString(
  address: string | AddressInfo | null
): string {
  assert(address, 'Could not bind server socket');
  if (typeof address === 'string') {
    return address;
  }
  const resolvedPort = address.port;
  let resolvedHost =
    address.family === 'IPv4' ? address.address : `[${address.address}]`;
  if (resolvedHost === '0.0.0.0' || resolvedHost === '[::]') {
    resolvedHost = 'localhost';
  }
  return `http://${resolvedHost}:${resolvedPort}`;
}

function stripIpv6Brackets(hostname: string): string {
  return hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
}

export function normalizeHostHeader(value: string): string | null {
  if (value.includes('@')) {
    return null;
  }
  try {
    const hostname = new URL(`http://${value}`).hostname.toLowerCase();
    return stripIpv6Brackets(hostname);
  } catch {
    return null;
  }
}

function normalizeConfiguredHost(value: string): string | null {
  const normalized = normalizeHostHeader(value);
  if (normalized) {
    return normalized;
  }
  const bareHost = stripIpv6Brackets(value.trim().toLowerCase());
  return isIP(bareHost) ? bareHost : null;
}

export function isHostAllowed(
  hostHeader: string | undefined,
  boundHost: string | undefined,
  allowedHosts: readonly string[] | undefined
): boolean {
  if (!hostHeader) {
    return false;
  }
  if (allowedHosts?.includes('*')) {
    return true;
  }
  const host = normalizeHostHeader(hostHeader);
  if (!host) {
    return false;
  }
  if (allowedHosts?.length) {
    return allowedHosts.some(
      (allowed) => normalizeConfiguredHost(allowed) === host
    );
  }
  const defaults = new Set(['localhost', '127.0.0.1', '::1']);
  if (boundHost && boundHost !== '0.0.0.0' && boundHost !== '::') {
    const normalizedBoundHost = normalizeConfiguredHost(boundHost);
    if (normalizedBoundHost) {
      defaults.add(normalizedBoundHost);
    }
  }
  return defaults.has(host);
}
