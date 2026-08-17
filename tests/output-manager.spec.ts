import { promises as fs } from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { outputFile } from '../src/config.js';
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

test('contexts sharing an output directory share one eviction queue', async ({
  page: _page,
}, testInfo) => {
  const directory = testInfo.outputPath('shared-outputs');
  const alias = path.join(testInfo.outputPath('shared-alias-parent'), 'link');
  await fs.mkdir(directory, { recursive: true });
  await fs.mkdir(path.dirname(alias), { recursive: true });
  await fs.symlink(directory, alias, 'dir');

  const [direct, aliased] = await Promise.all([
    OutputManager.forDirectory(directory, 100),
    OutputManager.forDirectory(alias, 100),
  ]);
  // Instances stay separate so each caller's lexical containment checks use
  // the path form that caller provides; eviction still serializes.
  expect(aliased).not.toBe(direct);
  await expect(
    aliased.finalizeFile(path.join(alias, 'contained.bin'))
  ).resolves.toBeUndefined();

  // Concurrent finalizations through separate instances of the same
  // directory must not evict each other's protected targets: the stale file
  // is evicted and at least one concurrently finalized file survives.
  const stale = path.join(directory, 'stale.bin');
  const left = path.join(directory, 'left.bin');
  const right = path.join(directory, 'right.bin');
  await fs.writeFile(stale, Buffer.alloc(80));
  await fs.utimes(stale, new Date(1), new Date(1));
  await fs.writeFile(left, Buffer.alloc(80));
  await fs.writeFile(right, Buffer.alloc(80));
  await Promise.all([
    direct.finalizeFile(left),
    direct.finalizeFile(right),
    aliased.finalizeFile(path.join(alias, 'left.bin')),
  ]);
  await expect(fs.stat(stale)).rejects.toMatchObject({ code: 'ENOENT' });
  const survivors = (await fs.readdir(directory))
    .filter((name) => name.endsWith('.bin'))
    .sort();
  // Whichever finalization runs first evicts the stale file and, under the
  // 100-byte quota, exactly one of the concurrently finalized files — the
  // one whose eviction pass completed first. Independent queues could
  // interleave and lose both.
  expect(survivors).not.toContain('stale.bin');
  expect(
    survivors.filter((name) => name === 'left.bin' || name === 'right.bin')
      .length
  ).toBe(1);
});

test('reserved outputs survive concurrent eviction pressure', async ({
  page: _page,
}, testInfo) => {
  const directory = testInfo.outputPath('reserved-outputs');
  await fs.mkdir(directory, { recursive: true });
  const writer = await OutputManager.forDirectory(directory, 100);
  const finalizer = await OutputManager.forDirectory(directory, 100);

  const stale = path.join(directory, 'stale.bin');
  const reserved = path.join(directory, 'reserved.bin');
  const finalized = path.join(directory, 'finalized.bin');
  await fs.writeFile(stale, Buffer.alloc(80));
  await fs.utimes(stale, new Date(1), new Date(1));
  const reservedPath = await writer.reserveFile(reserved);
  await fs.writeFile(reserved, Buffer.alloc(80));
  await fs.writeFile(finalized, Buffer.alloc(80));

  // Eviction pressure from another finalization must skip the reserved,
  // written-but-not-finalized file: only the stale file fits the quota.
  await finalizer.finalizeFile(finalized);
  await expect(fs.stat(reservedPath)).resolves.toBeTruthy();

  // Once finalized itself, the reservation is released and normal quota
  // eviction applies again.
  await writer.finalizeFile(reserved);
  const survivors = (await fs.readdir(directory)).sort();
  expect(survivors).toEqual(['reserved.bin']);
});

test('concurrent reserved finalizations keep each target through its own pass', async ({
  page: _page,
}, testInfo) => {
  const directory = testInfo.outputPath('reserved-concurrent');
  await fs.mkdir(directory, { recursive: true });
  const [first, second] = await Promise.all([
    OutputManager.forDirectory(directory, 100),
    OutputManager.forDirectory(directory, 100),
  ]);
  const left = path.join(directory, 'left.bin');
  const right = path.join(directory, 'right.bin');
  await fs.writeFile(left, Buffer.alloc(80));
  await fs.writeFile(right, Buffer.alloc(80));
  const leftReserved = await first.reserveFile(left);
  const rightReserved = await second.reserveFile(right);

  await Promise.all([
    first.finalizeFile(leftReserved),
    second.finalizeFile(rightReserved),
  ]);
  const survivors = (await fs.readdir(directory)).sort();
  // Each finalization holds its reservation until its own queued eviction
  // pass completes, so at least one of the two targets must survive.
  expect(
    survivors.filter((name) => name === 'left.bin' || name === 'right.bin')
      .length
  ).toBeGreaterThan(0);
});

test('default output directory is stable within a process', async ({
  page: _page,
}) => {
  const { resolveConfig } = await import('../src/config.js');
  const config = resolveConfig({});
  const first = await outputFile(config, undefined, 'first.png');
  const second = await outputFile(config, undefined, 'second.png');
  expect(path.dirname(second)).toBe(path.dirname(first));
  expect(path.basename(first)).toBe('first.png');
});

test('reserved directories shield their contents until finalized', async ({
  page: _page,
}, testInfo) => {
  const directory = testInfo.outputPath('reserved-directory');
  const sessionFolder = path.join(directory, 'session-1');
  await fs.mkdir(sessionFolder, { recursive: true });
  const sessionManager = await OutputManager.forDirectory(directory, 100);
  await sessionManager.reserveDirectory(sessionFolder);
  const logFile = path.join(sessionFolder, 'session.md');
  await fs.writeFile(logFile, Buffer.alloc(80));

  // Quota pressure from another artifact must not evict the active session
  // log even though it is the oldest content in the tree.
  const artifactManager = await OutputManager.forDirectory(directory, 100);
  const artifact = path.join(directory, 'artifact.bin');
  await fs.writeFile(artifact, Buffer.alloc(80));
  await artifactManager.finalizeFile(artifact);
  await expect(fs.stat(logFile)).resolves.toBeTruthy();

  // Disposing the session releases the reservation and eviction resumes.
  await sessionManager.finalizeDirectory(sessionFolder);
  await fs.writeFile(path.join(directory, 'newer.bin'), Buffer.alloc(80));
  await artifactManager.finalizeFile(path.join(directory, 'newer.bin'));
  await expect(fs.stat(logFile)).rejects.toMatchObject({ code: 'ENOENT' });
});

test('shared directory leases survive a sibling release', async ({
  page: _page,
}, testInfo) => {
  // Mirrors --isolated --save-trace HTTP sessions sharing one browser and
  // one traces directory: each session acquires its own lease; one session
  // closing must not unprotect the sibling's in-progress trace files.
  const directory = testInfo.outputPath('shared-leases');
  const shared = path.join(directory, 'traces');
  await fs.mkdir(shared, { recursive: true });
  const [sessionA, sessionB] = await Promise.all([
    OutputManager.forDirectory(directory, 100),
    OutputManager.forDirectory(directory, 100),
  ]);
  await sessionA.reserveDirectory(shared);
  await sessionB.reserveDirectory(shared);
  const traceFile = path.join(shared, 'a.trace');
  await fs.writeFile(traceFile, Buffer.alloc(80));
  // Make the trace file the oldest content so only its lease protects it.
  await fs.utimes(traceFile, new Date(1), new Date(1));
  const pressure = await OutputManager.forDirectory(directory, 100);

  // Session A closes first: quota pressure may evict anything except the
  // trace file, whose lease is still held by session B.
  await sessionA.finalizeDirectory(shared);
  const artifactA = path.join(directory, 'artifact-a.bin');
  await fs.writeFile(artifactA, Buffer.alloc(80));
  await pressure.finalizeFile(artifactA);
  await expect(fs.stat(traceFile)).resolves.toBeTruthy();

  // Session B closes too: the last lease is gone and the oldest unprotected
  // content becomes evictable again under pressure.
  await sessionB.finalizeDirectory(shared);
  const artifactB = path.join(directory, 'artifact-b.bin');
  await fs.writeFile(artifactB, Buffer.alloc(80));
  await pressure.finalizeFile(path.join(directory, 'artifact-b.bin'));
  await expect(fs.stat(traceFile)).rejects.toMatchObject({ code: 'ENOENT' });
});
