import { mkdir, symlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import {
  resolveWorkspaceInputPath,
  resolveWorkspaceOutputPath,
} from '../scripts/path-policy.js';

test('workspace path policy preserves repository-contained files', async () => {
  const root = test.info().outputPath('workspace');
  const fixtures = resolve(root, 'fixtures');
  await mkdir(fixtures, { recursive: true });
  const input = resolve(fixtures, 'input.json');
  await writeFile(input, '{}', 'utf8');

  await expect(
    resolveWorkspaceInputPath('fixtures/input.json', {
      extension: '.json',
      label: '--fixture',
      root,
    })
  ).resolves.toBe(input);
  await expect(
    resolveWorkspaceOutputPath('report.md', {
      label: '--output',
      root,
    })
  ).resolves.toBe(resolve(root, 'report.md'));
});

test('workspace path policy rejects traversal and unexpected extensions', async () => {
  const root = test.info().outputPath('workspace');
  await mkdir(root, { recursive: true });
  await writeFile(test.info().outputPath('outside.json'), '{}', 'utf8');
  await writeFile(resolve(root, 'fixture.txt'), '{}', 'utf8');

  await expect(
    resolveWorkspaceInputPath('../outside.json', {
      extension: '.json',
      label: '--fixture',
      root,
    })
  ).rejects.toThrow('must stay inside');
  await expect(
    resolveWorkspaceInputPath('fixture.txt', {
      extension: '.json',
      label: '--fixture',
      root,
    })
  ).rejects.toThrow('must use the .json extension');
});

test('workspace path policy rejects symlinks that escape the workspace', async () => {
  const root = test.info().outputPath('workspace');
  await mkdir(root, { recursive: true });
  const outside = test.info().outputPath('outside.json');
  await writeFile(outside, '{}', 'utf8');
  await symlink(outside, resolve(root, 'linked.json'));

  await expect(
    resolveWorkspaceInputPath('linked.json', {
      extension: '.json',
      label: '--fixture',
      root,
    })
  ).rejects.toThrow('must stay inside');
  await expect(
    resolveWorkspaceOutputPath('linked.json', {
      label: '--output',
      root,
    })
  ).rejects.toThrow('must not be a symbolic link');
});
