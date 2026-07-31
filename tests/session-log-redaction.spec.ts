import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { resolveConfig } from '../src/config.js';
import type { Response } from '../src/response.js';
import { SessionLog } from '../src/session-log.js';

const SECRET = 'session-secret-value';

function responseStub(): Response {
  return {
    toolName: 'browser_evaluate',
    toolArgs: { token: SECRET, nested: { value: SECRET } },
    result: () => `result contains ${SECRET}`,
    isError: () => false,
    code: () => `await page.evaluate(() => '${SECRET}')`,
    tabSnapshot: () => ({
      url: `https://example.test/?token=${SECRET}`,
      title: 'Secret page',
      ariaSnapshot: `- text: ${SECRET}`,
      modalStates: [],
      consoleMessages: [],
      downloads: [],
    }),
  } as unknown as Response;
}

test('saved session logs redact configured secrets and await snapshots', async ({ page: _page }, testInfo) => {
  const outputDir = testInfo.outputPath('sessions');
  const log = await SessionLog.create(
    resolveConfig({
      outputDir,
      secrets: { API_TOKEN: SECRET },
      saveSession: true,
    }),
    undefined
  );

  log.logResponse(responseStub());
  await log.dispose();

  const entries = await readdir(outputDir, { withFileTypes: true });
  const sessionDirectory = entries.find((entry) => entry.isDirectory());
  expect(sessionDirectory).toBeTruthy();
  const folder = join(outputDir, sessionDirectory?.name ?? 'missing');
  const session = await readFile(join(folder, 'session.md'), 'utf8');
  const snapshot = await readFile(join(folder, '001.snapshot.yml'), 'utf8');

  expect(session).not.toContain(SECRET);
  expect(snapshot).not.toContain(SECRET);
  expect(session).toContain('<redacted:API_TOKEN>');
  expect(snapshot).toContain('<redacted:API_TOKEN>');
});
