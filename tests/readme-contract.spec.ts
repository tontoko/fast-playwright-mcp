import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

function occurrenceCount(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

test('README contains one generated tool catalog with current batch schema', async () => {
  const readme = await readFile('README.md', 'utf8');

  expect(occurrenceCount(readme, '- **browser_batch_execute**')).toBe(1);
  expect(occurrenceCount(readme, '- **browser_dashboard**')).toBe(1);
  expect(readme).not.toContain('`maxConcurrency`');
  expect(readme).toContain(
    '`stopOnFirstError` (boolean, optional): Stop entire batch on first error'
  );
});

test('README programmatic example uses the returned MCP server directly', async () => {
  const readme = await readFile('README.md', 'utf8');

  expect(readme).not.toContain('connection.sever.connect');
  expect(readme).toContain('await connection.connect(transport);');
});
