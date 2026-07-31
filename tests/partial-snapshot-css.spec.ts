import { expect, test } from './fixtures.js';
import { COMMON_EXPECTATIONS, callTool } from './test-helpers.js';

test('snapshotOptions.selector scopes the snapshot with a CSS selector', async ({
  client,
  server,
}) => {
  server.setContent(
    '/partial-css',
    `<!doctype html>
      <html>
        <body>
          <header>Outside header</header>
          <main>
            <section class="target"><h1>Target content</h1></section>
            <section><h2>Outside sibling</h2></section>
          </main>
        </body>
      </html>`,
    'text/html'
  );
  await callTool(client, 'browser_navigate', {
    url: `${server.PREFIX}partial-css`,
    expectation: COMMON_EXPECTATIONS.MINIMAL_RESPONSE,
  });

  const result = await callTool(client, 'browser_snapshot', {
    expectation: {
      includeSnapshot: true,
      snapshotOptions: { selector: '.target' },
    },
  });
  const text = result.content[0].text;

  expect(text).toContain('Target content');
  expect(text).not.toContain('Outside header');
  expect(text).not.toContain('Outside sibling');
});
