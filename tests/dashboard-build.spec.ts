import { createHash } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { DASHBOARD_HTML } from '../src/apps/generated/dashboard.js';

const SCRIPT_PATTERN = /<script type="module">([\s\S]*?)<\/script>/u;
const STYLE_PATTERN = /<style>([\s\S]*?)<\/style>/u;
const CSP_PATTERN = /Content-Security-Policy" content="([^"]+)"/u;
const SCRIPT_SRC_PATTERN = /<script[^>]+src=/u;

function hash(value: string): string {
  return `sha256-${createHash('sha256').update(value).digest('base64')}`;
}

test('dashboard is self-contained and protected by exact CSP hashes', () => {
  expect(DASHBOARD_HTML.startsWith('<!doctype html>')).toBe(true);
  expect(DASHBOARD_HTML).not.toContain('<script src=');
  expect(DASHBOARD_HTML).not.toContain('<link rel=');
  expect(DASHBOARD_HTML).not.toMatch(SCRIPT_SRC_PATTERN);
  const script = SCRIPT_PATTERN.exec(DASHBOARD_HTML)?.[1];
  const style = STYLE_PATTERN.exec(DASHBOARD_HTML)?.[1];
  const csp = CSP_PATTERN.exec(DASHBOARD_HTML)?.[1];
  expect(script).toBeTruthy();
  expect(style).toBeTruthy();
  expect(csp).toContain(`script-src '${hash(script ?? '')}'`);
  expect(csp).toContain(`style-src '${hash(style ?? '')}'`);
  expect(csp).toContain("connect-src 'none'");
});
