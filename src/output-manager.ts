import { promises as fs } from 'node:fs';
import { dirname, resolve } from 'node:path';

type OutputEntry = {
  path: string;
  size: number;
  mtimeMs: number;
};

export class OutputManager {
  private queue = Promise.resolve();

  constructor(
    private readonly outputDir: string,
    private readonly maxSize: number
  ) {}

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
    this.queue = this.queue.then(() => this.evict(target));
    await this.queue;
  }

  private async evict(target: string): Promise<void> {
    if (this.maxSize <= 0) {
      return;
    }

    const entries = await this.collectEntries();
    let total = entries.reduce((sum, entry) => sum + entry.size, 0);
    for (const entry of entries) {
      if (total <= this.maxSize) {
        break;
      }
      if (entry.path === target) {
        continue;
      }
      await fs.unlink(entry.path).catch(() => undefined);
      total -= entry.size;
    }
  }

  private async collectEntries(): Promise<OutputEntry[]> {
    const entries: OutputEntry[] = [];
    const visit = async (directory: string): Promise<void> => {
      const children = await fs.readdir(directory, { withFileTypes: true }).catch(
        () => []
      );
      for (const child of children) {
        const path = resolve(directory, child.name);
        if (child.isSymbolicLink()) {
          continue;
        }
        if (child.isDirectory()) {
          await visit(path);
          continue;
        }
        if (!child.isFile()) {
          continue;
        }
        const stat = await fs.lstat(path);
        entries.push({ path, size: stat.size, mtimeMs: stat.mtimeMs });
      }
    };
    await visit(this.outputDir);
    return entries.sort(
      (left, right) =>
        left.mtimeMs - right.mtimeMs || left.path.localeCompare(right.path)
    );
  }
}
