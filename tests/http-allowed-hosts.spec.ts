import { expect, test } from '@playwright/test';
import { isHostAllowed, normalizeHostHeader } from '../src/http-server.js';

test('normalizes valid Host headers and strips ports and IPv6 brackets', () => {
  expect(normalizeHostHeader('localhost:3000')).toBe('localhost');
  expect(normalizeHostHeader('127.0.0.1:3000')).toBe('127.0.0.1');
  expect(normalizeHostHeader('[::1]:3000')).toBe('::1');
});

test('rejects malformed and credential-bearing Host headers', () => {
  expect(normalizeHostHeader('user@example.test')).toBeNull();
  expect(normalizeHostHeader('[not-ipv6')).toBeNull();
  expect(isHostAllowed(undefined, '127.0.0.1', undefined)).toBe(false);
});

test('allows IPv4 and IPv6 loopback defaults and configured hosts', () => {
  expect(isHostAllowed('localhost:3000', '127.0.0.1', undefined)).toBe(true);
  expect(isHostAllowed('127.0.0.1:3000', '127.0.0.1', undefined)).toBe(true);
  expect(isHostAllowed('[::1]:3000', '::1', undefined)).toBe(true);
  expect(isHostAllowed('[::1]:3000', '[::1]', undefined)).toBe(true);
  expect(isHostAllowed('attacker.example', '127.0.0.1', undefined)).toBe(false);
  expect(isHostAllowed('mcp.internal:8080', '0.0.0.0', ['mcp.internal'])).toBe(
    true
  );
  expect(isHostAllowed('anything.example', '0.0.0.0', ['*'])).toBe(true);
});
