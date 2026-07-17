import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

function property(text: string, name: string): string | undefined {
  return text
    .split('\n')
    .find((line) => line.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

test('scanner-facing source files are valid UTF-8', async () => {
  const { validateRepositoryEncoding } = await import(
    '../scripts/check-encoding.js'
  );
  await expect(validateRepositoryEncoding()).resolves.toEqual([]);
});

test('SonarQube encoding and generated-file exclusions are explicit', async () => {
  const [scannerProperties, automaticProperties] = await Promise.all([
    readFile('sonar-project.properties', 'utf8'),
    readFile('.sonarcloud.properties', 'utf8'),
  ]);
  expect(property(scannerProperties, 'sonar.sourceEncoding')).toBe('UTF-8');
  expect(property(scannerProperties, 'sonar.exclusions')?.split(',')).toEqual(
    expect.arrayContaining([
      'src/apps/generated/**',
      '**/*.b64',
      '**/*.tsbuildinfo',
    ])
  );
  expect(property(automaticProperties, 'sonar.sourceEncoding')).toBe('UTF-8');
  expect(property(automaticProperties, 'sonar.sources')?.split(',')).toEqual(
    expect.arrayContaining(['src', 'extension/src', 'scripts', 'benchmark'])
  );
  expect(
    property(automaticProperties, 'sonar.exclusions')?.split(',')
  ).toContain('src/apps/generated/dashboard.ts');
});
