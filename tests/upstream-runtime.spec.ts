import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import packageJSON from '../package.json' with { type: 'json' };
import { formatBrowserLaunchError } from '../src/browser-context-factory.js';
import { resolveCLIConfig, resolveConfig } from '../src/config.js';
import { findExtensionProfile } from '../src/extension/profile.js';
import { isDownloadNavigationError } from '../src/tab.js';
import { quote } from '../src/utils/codegen.js';
import {
  generateKeyPressCode,
  generateNavigationCode,
} from '../src/utils/common-formatters.js';

const OLD_PLAYWRIGHT_VERSION = '1.63.0-alpha-2026-08-05';
const MCP_REVIEWED_COMMIT = '7e0457a7cbf88823bf0146d12c46ae12c6818247';
const PLAYWRIGHT_REVIEWED_COMMIT = 'd5a185a894ab3ab17ff77a44e116a1339c6bdaed';
const EXTENSION_ID = 'jakfalbnbhgkpmoaakfflhflbfpkailf';
const OLD_ACTION_PINS = [
  '34e114876b0b11c390a56381ad16ebd13914f8d5',
  '49933ea5288caeca8642d1e84afbd3f7d6820020',
  '8d2750c68a42422c14e847fe6c8ac0403b4cbd6f',
  '10e90e3645eae34f1e60eeb005ba3a3d33f178e8',
];

test('generated code escapes user-controlled strings', () => {
  expect(quote("it's\nC:\\temp")).toBe("'it\\'s\\nC:\\\\temp'");
  expect(generateNavigationCode("https://example.test/it's")).toBe(
    "await page.goto('https://example.test/it\\'s');"
  );
  expect(generateKeyPressCode("Control+'")).toBe(
    "await page.keyboard.press('Control+\\'');"
  );
});

test('settle timeout resolves from defaults, CLI, and environment', async () => {
  expect(resolveConfig({}).timeouts.settle).toBe(500);
  expect(
    (await resolveCLIConfig({ timeoutSettle: 125 }, {})).timeouts.settle
  ).toBe(125);
  expect(
    (await resolveCLIConfig({}, { PLAYWRIGHT_MCP_TIMEOUT_SETTLE: '250' }))
      .timeouts.settle
  ).toBe(250);
});

test('all CDP header sources reject invalid names and line breaks', () => {
  expect(() =>
    resolveConfig({
      browser: { cdpHeaders: { 'Bad Header': 'value' } },
    })
  ).toThrow('Invalid header');
  expect(() =>
    resolveConfig({
      browser: { cdpHeaders: { 'X-Test': 'safe\r\nInjected: value' } },
    })
  ).toThrow('Invalid header');
});

test('navigation errors classify only explicit downloads as downloads', () => {
  expect(isDownloadNavigationError(new Error('net::ERR_ABORTED'))).toBe(false);
  expect(isDownloadNavigationError(new Error('Download is starting'))).toBe(
    true
  );
});

test('missing browser diagnostics preserve the executable path', () => {
  const executable = '/tmp/ms-playwright/firefox-1534/firefox/firefox';
  const error = formatBrowserLaunchError(
    new Error(`browserType.launch: Executable doesn't exist at ${executable}`),
    resolveConfig({ browser: { browserName: 'firefox' } })
  );
  expect(error.message).toContain(executable);
  expect(error.message).toContain('is not installed');
});

test('extension profile discovery prefers the browser last-used profile', async ({
  page: _page,
}, testInfo) => {
  const userDataDir = testInfo.outputPath('user-data');
  await Promise.all([
    mkdir(join(userDataDir, 'Default', 'Extensions', EXTENSION_ID), {
      recursive: true,
    }),
    mkdir(join(userDataDir, 'Profile 2', 'Extensions', EXTENSION_ID), {
      recursive: true,
    }),
  ]);
  await writeFile(
    join(userDataDir, 'Local State'),
    JSON.stringify({ profile: { last_used: 'Profile 2' } }),
    'utf8'
  );

  expect(await findExtensionProfile(userDataDir, EXTENSION_ID)).toBe(
    'Profile 2'
  );
});

test('upstream manifest and package record the reviewed current state', async () => {
  const manifest = JSON.parse(await readFile('upstream.json', 'utf8')) as {
    reviewedCommit: string;
    playwrightReviewedCommit: string;
    playwrightVersion: string;
    packageVersion: string;
  };
  expect(manifest.reviewedCommit).toBe(MCP_REVIEWED_COMMIT);
  expect(manifest.playwrightReviewedCommit).toBe(PLAYWRIGHT_REVIEWED_COMMIT);
  expect(manifest.packageVersion).toBe('0.0.79');
  expect(manifest.playwrightVersion).toBe('1.63.0-alpha-2026-08-17');
  expect(manifest.playwrightVersion).toBe(packageJSON.dependencies.playwright);
  expect(packageJSON.dependencies['playwright-core']).toBe(
    manifest.playwrightVersion
  );
  expect(packageJSON.devDependencies['@playwright/test']).toBe(
    manifest.playwrightVersion
  );
  expect(manifest.playwrightVersion).not.toBe(OLD_PLAYWRIGHT_VERSION);
  expect(packageJSON.engines.node).toBe('>=20');

  const declaration = await readFile('index.d.ts', 'utf8');
  expect(declaration.startsWith('#!')).toBe(false);
  expect(declaration).toContain('): Server;');
  expect(declaration).not.toContain('): Promise<Server>;');
});

test('workflows use current action runtimes', async () => {
  const names = (await readdir('.github/workflows')).filter(
    (name) => name.endsWith('.yml') || name.endsWith('.yaml')
  );
  const workflows = (
    await Promise.all(
      names.map((name) => readFile(join('.github/workflows', name), 'utf8'))
    )
  ).join('\n');
  for (const oldPin of OLD_ACTION_PINS) {
    expect(workflows).not.toContain(oldPin);
  }
  expect(workflows).toContain('fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09');
  expect(workflows).toContain('a0853c24544627f65ddf259abe73b1d18a591444');
});
