import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const ROOT = process.cwd();
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  '.scannerwork',
  'build',
  'coverage',
  'dist',
  'lib',
  'node_modules',
  'playwright-report',
  'test-results',
]);
const BINARY_EXTENSIONS = new Set([
  '.gif',
  '.gz',
  '.ico',
  '.jpeg',
  '.jpg',
  '.otf',
  '.pdf',
  '.png',
  '.tgz',
  '.ttf',
  '.wasm',
  '.webp',
  '.woff',
  '.woff2',
  '.zip',
]);
const UTF8_BOM = Buffer.from([0xef, 0xbb, 0xbf]);

function collectEntry(
  directory: string,
  entry: Awaited<ReturnType<typeof readdir>>[number]
): Promise<string[]> {
  if (entry.isSymbolicLink()) {
    return Promise.resolve([]);
  }
  const path = join(directory, entry.name);
  if (entry.isDirectory()) {
    return SKIPPED_DIRECTORIES.has(entry.name)
      ? Promise.resolve([])
      : collectFiles(path);
  }
  return Promise.resolve(entry.isFile() ? [path] : []);
}

async function collectFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const results = await Promise.all(
    entries.map((entry) => collectEntry(directory, entry))
  );
  return results.flat();
}

function validateText(data: Buffer): string | undefined {
  if (data.subarray(0, UTF8_BOM.length).equals(UTF8_BOM)) {
    return 'UTF-8 BOM is not allowed';
  }
  if (data.includes(0)) {
    return 'contains NUL bytes but is not declared as a binary file';
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(data);
    return;
  } catch (error) {
    return `is not valid UTF-8: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
}

export async function validateRepositoryEncoding(
  root = ROOT
): Promise<string[]> {
  const textFiles = (await collectFiles(root)).filter(
    (path) => !BINARY_EXTENSIONS.has(extname(path).toLowerCase())
  );
  return (
    await Promise.all(
      textFiles.map(async (path) => {
        const problem = validateText(await readFile(path));
        return problem ? `${relative(root, path)}: ${problem}` : undefined;
      })
    )
  ).filter((failure): failure is string => Boolean(failure));
}

if (import.meta.main) {
  const failures = await validateRepositoryEncoding();
  if (failures.length) {
    throw new Error(`Source encoding check failed:\n${failures.join('\n')}`);
  }
  process.stdout.write('Source encoding check passed.\n');
}
