import { promises as fs } from 'node:fs';
import {
  basename,
  dirname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';

type OutputEntry = {
  path: string;
  size: number;
  mtimeMs: number;
};

type ExpectedPathKind = 'file' | 'directory';

const OUTSIDE_OUTPUT_ERROR =
  'Output path must remain inside the output directory';

function isErrnoException(
  error: unknown,
  code: NodeJS.ErrnoException['code']
): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === code
  );
}

function isPathInside(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return (
    pathFromRoot === '' ||
    (!isAbsolute(pathFromRoot) &&
      pathFromRoot !== '..' &&
      !pathFromRoot.startsWith(`..${sep}`))
  );
}

export class OutputManager {
  private queue: Promise<void> = Promise.resolve();
  private readonly lexicalOutputDir: string;
  private canonicalOutputDirPromise: Promise<string> | undefined;
  private readonly maxSize: number;

  constructor(outputDir: string, maxSize: number) {
    this.lexicalOutputDir = resolve(outputDir);
    this.maxSize = maxSize;
  }

  async reserveFile(path: string): Promise<string> {
    const absolute = this.assertLexicallyContained(path);
    if (absolute === this.lexicalOutputDir) {
      throw new Error(OUTSIDE_OUTPUT_ERROR);
    }

    const canonicalParent = await this.ensureSafeDirectory(dirname(absolute));
    const target = resolve(canonicalParent, basename(absolute));
    const root = await this.canonicalOutputDirectory();
    if (!isPathInside(root, target)) {
      throw new Error(OUTSIDE_OUTPUT_ERROR);
    }

    try {
      const status = await fs.lstat(target);
      if (status.isSymbolicLink() || !status.isFile()) {
        throw new Error(OUTSIDE_OUTPUT_ERROR);
      }
      const canonicalTarget = await fs.realpath(target);
      if (!isPathInside(root, canonicalTarget)) {
        throw new Error(OUTSIDE_OUTPUT_ERROR);
      }
      return canonicalTarget;
    } catch (error) {
      if (isErrnoException(error, 'ENOENT')) {
        return target;
      }
      throw error;
    }
  }

  async finalizeFile(path: string): Promise<void> {
    const target = await this.resolveFinalizationTarget(path, 'file');
    await this.enqueue(() => this.evict(target, false));
  }

  async finalizeDirectory(path: string): Promise<void> {
    const target = await this.resolveFinalizationTarget(path, 'directory');
    await this.enqueue(() => this.evict(target, true));
  }

  private canonicalOutputDirectory(): Promise<string> {
    this.canonicalOutputDirPromise ??= this.initializeOutputDirectory();
    return this.canonicalOutputDirPromise;
  }

  private async initializeOutputDirectory(): Promise<string> {
    await fs.mkdir(this.lexicalOutputDir, { recursive: true });
    return fs.realpath(this.lexicalOutputDir);
  }

  private assertLexicallyContained(path: string): string {
    const absolute = resolve(path);
    if (!isPathInside(this.lexicalOutputDir, absolute)) {
      throw new Error(OUTSIDE_OUTPUT_ERROR);
    }
    return absolute;
  }

  private async ensureSafeDirectory(directory: string): Promise<string> {
    const absolute = this.assertLexicallyContained(directory);
    const root = await this.canonicalOutputDirectory();
    const pathFromRoot = relative(this.lexicalOutputDir, absolute);
    const segments = pathFromRoot.split(sep).filter(Boolean);
    return this.ensureSafeDirectorySegments(root, root, segments, 0);
  }

  private async ensureSafeDirectorySegments(
    root: string,
    current: string,
    segments: readonly string[],
    index: number
  ): Promise<string> {
    if (index >= segments.length) {
      return current;
    }
    const next = resolve(current, segments[index]);
    try {
      const status = await fs.lstat(next);
      if (status.isSymbolicLink() || !status.isDirectory()) {
        throw new Error(OUTSIDE_OUTPUT_ERROR);
      }
    } catch (error) {
      if (!isErrnoException(error, 'ENOENT')) {
        throw error;
      }
      await fs.mkdir(next);
    }
    const canonicalNext = await fs.realpath(next);
    if (!isPathInside(root, canonicalNext)) {
      throw new Error(OUTSIDE_OUTPUT_ERROR);
    }
    return this.ensureSafeDirectorySegments(
      root,
      canonicalNext,
      segments,
      index + 1
    );
  }

  private async resolveFinalizationTarget(
    path: string,
    expectedKind: ExpectedPathKind
  ): Promise<string> {
    const absolute = this.assertLexicallyContained(path);
    const root = await this.canonicalOutputDirectory();
    try {
      const status = await fs.lstat(absolute);
      if (status.isSymbolicLink()) {
        throw new Error(OUTSIDE_OUTPUT_ERROR);
      }
      if (
        (expectedKind === 'file' && !status.isFile()) ||
        (expectedKind === 'directory' && !status.isDirectory())
      ) {
        throw new Error(`Expected output ${expectedKind}: ${absolute}`);
      }
      const canonicalTarget = await fs.realpath(absolute);
      if (!isPathInside(root, canonicalTarget)) {
        throw new Error(OUTSIDE_OUTPUT_ERROR);
      }
      return canonicalTarget;
    } catch (error) {
      if (!isErrnoException(error, 'ENOENT')) {
        throw error;
      }
      const canonicalParent = await fs.realpath(dirname(absolute));
      if (!isPathInside(root, canonicalParent)) {
        throw new Error(OUTSIDE_OUTPUT_ERROR);
      }
      return resolve(canonicalParent, basename(absolute));
    }
  }

  private async enqueue(operation: () => Promise<void>): Promise<void> {
    const task = this.queue.then(operation, operation);
    this.queue = task.catch(() => {
      // Preserve queue progress while returning the original failure to caller.
    });
    await task;
  }

  private async evict(
    target: string,
    targetIsDirectory: boolean
  ): Promise<void> {
    if (this.maxSize <= 0) {
      return;
    }

    const entries = await this.collectEntries();
    const total = entries.reduce((sum, entry) => sum + entry.size, 0);
    await this.removeOldest(entries, target, targetIsDirectory, total, 0);
  }

  private async removeOldest(
    entries: readonly OutputEntry[],
    target: string,
    targetIsDirectory: boolean,
    total: number,
    index: number
  ): Promise<void> {
    if (total <= this.maxSize || index >= entries.length) {
      return;
    }
    const entry = entries[index];
    const protectedTarget =
      entry.path === target ||
      (targetIsDirectory && isPathInside(target, entry.path));
    if (protectedTarget) {
      await this.removeOldest(
        entries,
        target,
        targetIsDirectory,
        total,
        index + 1
      );
      return;
    }
    let nextTotal = total;
    try {
      await fs.unlink(entry.path);
      nextTotal -= entry.size;
    } catch (error) {
      if (!isErrnoException(error, 'ENOENT')) {
        throw error;
      }
    }
    await this.removeOldest(
      entries,
      target,
      targetIsDirectory,
      nextTotal,
      index + 1
    );
  }

  private async collectEntries(): Promise<OutputEntry[]> {
    const root = await this.canonicalOutputDirectory();
    const visit = async (directory: string): Promise<OutputEntry[]> => {
      const children = await fs
        .readdir(directory, { withFileTypes: true })
        .catch(() => []);
      const nested = await Promise.all(
        children.map(async (child): Promise<OutputEntry[]> => {
          const path = resolve(directory, child.name);
          if (child.isSymbolicLink()) {
            return [];
          }
          if (child.isDirectory()) {
            return visit(path);
          }
          if (!child.isFile()) {
            return [];
          }
          const stat = await fs.lstat(path);
          return [{ path, size: stat.size, mtimeMs: stat.mtimeMs }];
        })
      );
      return nested.flat();
    };
    const entries = await visit(root);
    return entries.sort(
      (left, right) =>
        left.mtimeMs - right.mtimeMs || left.path.localeCompare(right.path)
    );
  }
}