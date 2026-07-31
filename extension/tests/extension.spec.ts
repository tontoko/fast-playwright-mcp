/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { fileURLToPath } from 'node:url';
import type { BrowserContext } from 'playwright';
import { chromium } from 'playwright';
import { test as base, expect } from '../../tests/fixtures.js';

const HELLO_WORLD_SNAPSHOT_PATTERN =
  /^- generic \[active\] \[ref=[^\]]+\]: Hello, world!$/mu;
const CONNECT_PAGE_PREFIX =
  'chrome-extension://jakfalbnbhgkpmoaakfflhflbfpkailf/connect.html';

type BrowserWithExtension = {
  userDataDir: string;
  launch: () => Promise<BrowserContext>;
};

const test = base.extend<{ browserWithExtension: BrowserWithExtension }>({
  browserWithExtension: async ({ mcpBrowser }, use, testInfo) => {
    // The flags no longer work in Chrome since
    // https://chromium.googlesource.com/chromium/src/+/290ed8046692651ce76088914750cb659b65fb17%5E%21/chrome/browser/extensions/extension_service.cc?pli=1#
    test.skip(
      mcpBrowser !== 'chromium',
      '--load-extension is not supported for official builds of Chromium'
    );

    const pathToExtension = fileURLToPath(new URL('../dist', import.meta.url));

    let browserContext: BrowserContext | undefined;
    const userDataDir = testInfo.outputPath('extension-user-data-dir');
    await use({
      userDataDir,
      launch: async () => {
        browserContext = await chromium.launchPersistentContext(userDataDir, {
          channel: mcpBrowser,
          // Opening the browser singleton only works in headed.
          headless: false,
          // Automation disables singleton browser process behavior, which is necessary for the extension.
          ignoreDefaultArgs: ['--enable-automation'],
          args: [
            `--disable-extensions-except=${pathToExtension}`,
            `--load-extension=${pathToExtension}`,
          ],
        });

        // for manifest v3:
        const [serviceWorker] = browserContext.serviceWorkers();
        if (!serviceWorker) {
          await browserContext.waitForEvent('serviceworker');
        }

        return browserContext;
      },
    });

    await browserContext?.close();
  },
});

function waitForConnectPage(browserContext: BrowserContext) {
  return browserContext.waitForEvent('page', (newPage) =>
    newPage.url().startsWith(CONNECT_PAGE_PREFIX)
  );
}

function failAfter<T>(milliseconds: number, message: string): Promise<T> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), milliseconds);
  });
}

test('navigate with extension', async ({
  browserWithExtension,
  startClient,
  server,
}) => {
  const browserContext = await browserWithExtension.launch();

  const { client } = await startClient({
    args: ['--connect-tool'],
    config: {
      browser: {
        userDataDir: browserWithExtension.userDataDir,
      },
    },
  });

  expect(
    await client.callTool({
      name: 'browser_connect',
      arguments: {
        name: 'extension',
      },
    })
  ).toHaveResponse({
    result: 'Successfully changed connection method.',
  });

  const confirmationPagePromise = waitForConnectPage(browserContext);

  const navigateResponse = client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  });

  const selectorPage = await confirmationPagePromise;
  await selectorPage
    .locator('.tab-item', { hasText: 'Playwright MCP Extension' })
    .getByRole('button', { name: 'Connect' })
    .click();

  expect(await navigateResponse).toHaveResponse({
    pageState: expect.stringMatching(HELLO_WORLD_SNAPSHOT_PATTERN),
  });
});

test('snapshot of an existing page', async ({
  browserWithExtension,
  startClient,
  server,
}) => {
  const browserContext = await browserWithExtension.launch();

  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  // Another empty page.
  await browserContext.newPage();
  expect(browserContext.pages()).toHaveLength(3);

  const { client } = await startClient({
    args: ['--connect-tool'],
    config: {
      browser: {
        userDataDir: browserWithExtension.userDataDir,
      },
    },
  });

  expect(
    await client.callTool({
      name: 'browser_connect',
      arguments: {
        name: 'extension',
      },
    })
  ).toHaveResponse({
    result: 'Successfully changed connection method.',
  });
  expect(browserContext.pages()).toHaveLength(3);

  const confirmationPagePromise = waitForConnectPage(browserContext);

  const snapshotResponse = client.callTool({
    name: 'browser_snapshot',
  });
  const selectorPage = await confirmationPagePromise;
  await selectorPage
    .locator('.tab-item', { hasText: 'Title' })
    .getByRole('button', { name: 'Connect' })
    .click();

  expect(await snapshotResponse).toHaveResponse({
    pageState: expect.stringContaining('Hello, world!'),
  });
});

test('rejecting a pending relay releases it and permits retry', async ({
  browserWithExtension,
  startClient,
  server,
}) => {
  const browserContext = await browserWithExtension.launch();
  const page = await browserContext.newPage();
  await page.goto(server.HELLO_WORLD);

  const { client } = await startClient({
    args: ['--connect-tool'],
    config: {
      browser: {
        userDataDir: browserWithExtension.userDataDir,
      },
    },
  });
  await client.callTool({
    name: 'browser_connect',
    arguments: { name: 'extension' },
  });

  const firstConnectPagePromise = waitForConnectPage(browserContext);
  const rejectedSnapshot = client.callTool({ name: 'browser_snapshot' });
  const firstConnectPage = await firstConnectPagePromise;
  await firstConnectPage.getByRole('button', { name: 'Reject' }).click();

  const rejectedResult = await Promise.race([
    rejectedSnapshot,
    failAfter<never>(5000, 'Rejected extension connection did not settle'),
  ]);
  expect(rejectedResult.isError).toBe(true);

  const secondConnectPagePromise = waitForConnectPage(browserContext);
  const retriedSnapshot = client.callTool({ name: 'browser_snapshot' });
  const secondConnectPage = await secondConnectPagePromise;
  await secondConnectPage
    .locator('.tab-item', { hasText: 'Title' })
    .getByRole('button', { name: 'Connect' })
    .click();

  expect(await retriedSnapshot).toHaveResponse({
    pageState: expect.stringContaining('Hello, world!'),
  });
});
