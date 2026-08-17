/**
 * browser_find_elements Tool Tests
 */

import { expect, test } from './fixtures.js';
import {
  expectFindElementsNoMatches,
  expectFindElementsSuccess,
  FIND_ELEMENTS_HTML_TEMPLATES,
  setupFindElementsTest,
} from './test-helpers.js';

test('browser_find_elements - find by multiple criteria', async ({
  client,
  server,
}) => {
  const result = await setupFindElementsTest(
    client,
    server,
    FIND_ELEMENTS_HTML_TEMPLATES.MULTI_CRITERIA_ELEMENTS,
    {
      text: 'Submit',
      role: 'button',
    },
    { maxResults: 5 }
  );

  expectFindElementsSuccess(result);
});

test('browser_find_elements - find by tag name', async ({ client, server }) => {
  const result = await setupFindElementsTest(
    client,
    server,
    FIND_ELEMENTS_HTML_TEMPLATES.FORM_WITH_INPUTS,
    { tagName: 'input' },
    { maxResults: 10 }
  );

  expectFindElementsSuccess(result);
});

test('browser_find_elements - find by attributes', async ({
  client,
  server,
}) => {
  const result = await setupFindElementsTest(
    client,
    server,
    FIND_ELEMENTS_HTML_TEMPLATES.BUTTONS_WITH_DATA_ACTION,
    {
      attributes: {
        'data-action': 'save',
      },
    }
  );

  expectFindElementsSuccess(result);
});

test('browser_find_elements - handle no matches', async ({
  client,
  server,
}) => {
  const result = await setupFindElementsTest(
    client,
    server,
    FIND_ELEMENTS_HTML_TEMPLATES.NO_BUTTONS_CONTENT,
    { role: 'button' }
  );

  expectFindElementsNoMatches(result);
});

test('browser_find_elements - limit results', async ({ client, server }) => {
  const result = await setupFindElementsTest(
    client,
    server,
    FIND_ELEMENTS_HTML_TEMPLATES.MULTIPLE_BUTTONS(10),
    { tagName: 'button' },
    { maxResults: 3 }
  );

  expectFindElementsSuccess(result);
});

test('browser_find_elements - role search respects max results', async ({
  client,
  server,
}) => {
  const result = await setupFindElementsTest(
    client,
    server,
    FIND_ELEMENTS_HTML_TEMPLATES.MULTIPLE_BUTTONS(10),
    { role: 'button' },
    { maxResults: 3 }
  );

  expectFindElementsSuccess(result);
  expect(result.content[0].text).toContain('Found 3 elements');
});

// Regression coverage for https://github.com/tontoko/fast-playwright-mcp/issues/27
// Playwright's role locator must handle both explicit and implicit ARIA roles.
const implicitRoleCases = [
  { role: 'heading', count: 2 },
  { role: 'paragraph', count: 2 },
  { role: 'separator', count: 1 },
  { role: 'button', count: 2 },
  { role: 'link', count: 1 },
] as const;

for (const { role, count } of implicitRoleCases) {
  test(`browser_find_elements - role ${role} finds implicit elements`, async ({
    client,
    server,
  }) => {
    const result = await setupFindElementsTest(
      client,
      server,
      FIND_ELEMENTS_HTML_TEMPLATES.IMPLICIT_ROLE_ELEMENTS,
      { role }
    );

    expectFindElementsSuccess(result);
    expect(result.content[0].text).toContain(`Found ${count} elements`);
    expect(result.content[0].text).toContain(`role match: "${role}"`);
  });
}

test('browser_find_elements - unknown role returns no matches without throwing', async ({
  client,
  server,
}) => {
  const result = await setupFindElementsTest(
    client,
    server,
    FIND_ELEMENTS_HTML_TEMPLATES.IMPLICIT_ROLE_ELEMENTS,
    { role: 'not-a-real-role' }
  );

  expectFindElementsNoMatches(result);
});
