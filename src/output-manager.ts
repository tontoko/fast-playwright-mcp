import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';

type OutputEntry = {
  path: string;
  size: number;
  mtimeMs: number;
};

export class OutputManager {
  private queue = Promise.resolve();
  private readonly outputDir: string;
  private readonly maxSize: number;

  constructor(outputDir: string, maxSize: number) {
    this.outputDir = outputDir;
    this.maxSize = maxSize;
  }

  async reserveFile(path: string): Promise<string> {
    const absolute = resolve(path);
    const root = resolve(this.outputDir);
    if (absolute !== root && !absolute.startsWith(`${root}/`)) {
      throw new Error('Output path must remain inside the output directory');
    }
    await fs.mkdir(dirname(absolute), { recursive: true });
    return absolute;
  }

  async finalizeFile(path: string): Promise<void> {
    const target = resolve(path);
    this.queue = this.queue.then(() => this.evict(target, false));
    await this.queue;
  }

  async finalizeDirectory(path: string): Promise<void> {
    const target = resolve(path);
    this.queue = this.queue.then(() => this.evict(target, true));
    await this.queue;
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
      (targetIsDirectory && entry.path.startsWith(`${target}/`));
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
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
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
    const entries = await visit(this.outputDir);
    return entries.sort(
      (left, right) =>
        left.mtimeMs - right.mtimeMs || left.path.localeCompare(right.path)
    );
  }
}
