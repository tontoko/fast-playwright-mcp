import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { startHttpServer } from '../src/http-server.js';
import { CDPRelayServer } from '../src/extension/cdp-relay.js';
import { DEFAULT_EXTENSION_ID } from '../src/extension/connect-url.js';

test('custom extension executable launch errors reject instead of crashing', async ({
  page: _page,
}, testInfo) => {
  const server = await startHttpServer({ host: '127.0.0.1' });
  const relay = new CDPRelayServer(
    server,
    'chromium',
    undefined,
    testInfo.outputPath('missing-browser')
  );
  try {
    await expect(
      relay.ensureExtensionConnectionForMCPContext(
        { name: 'relay-test', version: '1.0.0' },
        new AbortController().signal
      )
    ).rejects.toThrow();
  } finally {
    relay.stop();
  }
});

test('custom extension executables launch the profile containing the extension', async ({
  page: _page,
}, testInfo) => {
  test.skip(process.platform === 'win32', 'uses a POSIX test executable');
  const userDataDir = testInfo.outputPath('user-data');
  const profile = 'Profile 1';
  await mkdir(join(userDataDir, profile, 'Extensions', DEFAULT_EXTENSION_ID), {
    recursive: true,
  });
  await writeFile(
    join(userDataDir, 'Local State'),
    JSON.stringify({ profile: { last_used: profile } }),
    'utf8'
  );

  const argumentsFile = testInfo.outputPath('browser-arguments.txt');
  const executable = testInfo.outputPath('fake-browser.sh');
  await writeFile(
    executable,
    `#!/bin/sh\nprintf '%s\\n' "$@" > ${JSON.stringify(argumentsFile)}\n`,
    'utf8'
  );
  await chmod(executable, 0o755);

  const server = await startHttpServer({ host: '127.0.0.1' });
  const relay = new CDPRelayServer(
    server,
    'chromium',
    userDataDir,
    executable
  );
  const controller = new AbortController();
  const connection = relay.ensureExtensionConnectionForMCPContext(
    { name: 'relay-test', version: '1.0.0' },
    controller.signal
  );
  try {
    await expect
      .poll(
        async () =>
          readFile(argumentsFile, 'utf8').catch(() => ''),
        { timeout: 5000 }
      )
      .toContain(`--profile-directory=${profile}`);
  } finally {
    controller.abort(new Error('test complete'));
    await expect(connection).rejects.toThrow('test complete');
    relay.stop();
  }
});
