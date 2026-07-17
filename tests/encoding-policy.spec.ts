import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const TEXT_FILES = [
  '.gitattributes',
  'sonar-project.properties',
  'src/apps/generated/dashboard.ts',
  'src/config.ts',
  'src/mcp/server.ts',
] as const;

test('scanner-facing source files are valid UTF-8', async () => {
  for (const path of TEXT_FILES) {
    const bytes = await readFile(path);
    expect(() => UTF8_DECODER.decode(bytes), path).not.toThrow();
  }
});

test('SonarQube encoding and generated-file exclusions are explicit', async () => {
  const properties = await readFile('sonar-project.properties', 'utf8');
  expect(properties).toContain('sonar.sourceEncoding=UTF-8');
  expect(properties).toContain('src/apps/generated/**');
  expect(properties).toContain('**/*.b64');
});
