import { promises as fs } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { OutputManager } from '../src/output-manager.js';

test('evicts oldest completed files while preserving the finalized target', async ({
  page: _page,
}, testInfo) => {
  const directory = testInfo.outputPath('outputs');
  await fs.mkdir(directory, { recursive: true });
  const oldFile = path.join(directory, 'old.bin');
  const target = path.join(directory, 'target.bin');
  await fs.writeFile(oldFile, Buffer.alloc(80));
  await fs.utimes(oldFile, new Date(1), new Date(1));
  await fs.writeFile(target, Buffer.alloc(80));
  const manager = new OutputManager(directory, 100);
  await manager.finalizeFile(target);
  await expect(fs.stat(target)).resolves.toBeTruthy();
  await expect(fs.stat(oldFile)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('does not follow file symlinks and rejects lexical path traversal', async ({
  page: _page,
}, testInfo) => {
  const directory = testInfo.outputPath('safe');
  const outside = testInfo.outputPath('outside.bin');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(outside, Buffer.alloc(10));
  await fs.symlink(outside, path.join(directory, 'link.bin'));
  const manager = new OutputManager(directory, 1);
  await expect(
    manager.reserveFile(path.join(directory, '..', 'escape.bin'))
  ).rejects.toThrow('Output path must remain inside the output directory');
  await manager.finalizeFile(path.join(directory, 'target.bin'));
  await expect(fs.stat(outside)).resolves.toBeTruthy();
});

test('rejects a symlinked parent that escapes the output directory', async ({
  page: _page,
}, testInfo) => {
  const directory = testInfo.outputPath('safe-parent');
  const outside = testInfo.outputPath('outside-directory');
  await Promise.all([
    fs.mkdir(directory, { recursive: true }),
    fs.mkdir(outside, { recursive: true }),
  ]);
  await fs.symlink(outside, path.join(directory, 'linked'), 'dir');
  const manager = new OutputManager(directory, 0);

  await expect(
    manager.reserveFile(path.join(directory, 'linked', 'escape.txt'))
  ).rejects.toThrow('Output path must remain inside the output directory');
});

test('rejects finalization targets outside the output directory', async ({
  page: _page,
}, testInfo) => {
  const directory = testInfo.outputPath('finalization-root');
  const outside = testInfo.outputPath('outside-finalization.bin');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(outside, Buffer.alloc(1));
  const manager = new OutputManager(directory, 0);

  await expect(manager.finalizeFile(outside)).rejects.toThrow(
    'Output path must remain inside the output directory'
  );
  await expect(
    manager.finalizeDirectory(path.dirname(outside))
  ).rejects.toThrow('Output path must remain inside the output directory');
});
