import assert from 'node:assert/strict';
import http from 'node:http';
import type * as net from 'node:net';
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
  address: string | net.AddressInfo | null
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

export function normalizeHostHeader(value: string): string | null {
  if (value.includes('@')) {
    return null;
  }
  try {
    return new URL(`http://${value}`).hostname.toLowerCase();
  } catch {
    return null;
  }
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
    return allowedHosts.some((allowed) => {
      const normalized = normalizeHostHeader(allowed);
      return normalized === host || allowed.toLowerCase() === host;
    });
  }
  const defaults = new Set(['localhost', '127.0.0.1', '::1']);
  if (boundHost && boundHost !== '0.0.0.0' && boundHost !== '::') {
    defaults.add(boundHost.toLowerCase());
  }
  return defaults.has(host);
}
