import { mkdir, readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { OutputManager } from '../src/output-manager.js';
import type { Response } from '../src/response.js';
import { SessionLog } from '../src/session-log.js';
import type { TabSnapshot } from '../src/tab.js';
import { SecretRedactor } from '../src/utils/secret-redactor.js';

function snapshot(label: string): TabSnapshot {
  return {
    url: `https://example.test/${label}`,
    title: label,
    ariaSnapshot: `${label}: ${'x'.repeat(180)}`,
    modalStates: [],
    consoleMessages: [],
    downloads: [],
  };
}

function response(label: string): Response {
  return {
    toolName: `browser_${label}`,
    toolArgs: { label },
    result: () => label,
    isError: () => false,
    code: () => '',
    tabSnapshot: () => snapshot(label),
  } as unknown as Response;
}

test('active session directory is finalized as one eviction unit', async ({
  page: _page,
}, testInfo) => {
  const outputRoot = testInfo.outputPath('output');
  const sessionFolder = testInfo.outputPath('output', 'session-active');
  await mkdir(sessionFolder, { recursive: true });
  const log = new SessionLog(
    sessionFolder,
    new OutputManager(outputRoot, 240),
    new SecretRedactor(undefined)
  );

  log.logResponse(response('first'));
  await expect
    .poll(async () =>
      readFile(`${sessionFolder}/session.md`, 'utf8').catch(() => '')
    )
    .toContain('browser_first');

  log.logResponse(response('second'));
  await log.dispose();

  const contents = await readFile(`${sessionFolder}/session.md`, 'utf8');
  expect(contents).toContain('browser_first');
  expect(contents).toContain('browser_second');
});
