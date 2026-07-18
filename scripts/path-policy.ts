import { lstat, realpath } from 'node:fs/promises';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  relative,
  resolve,
  sep,
} from 'node:path';

type WorkspacePathOptions = {
  extension?: string;
  label?: string;
  root?: string;
};

function assertSafeCandidate(candidate: string, label: string): void {
  if (!candidate || candidate.includes('\0')) {
    throw new Error(`${label} must be a non-empty path without NUL bytes`);
  }
}

function assertInsideRoot(
  root: string,
  candidate: string,
  label: string
): void {
  const pathFromRoot = relative(root, candidate);
  const escapesRoot =
    pathFromRoot === '..' ||
    pathFromRoot.startsWith(`..${sep}`) ||
    isAbsolute(pathFromRoot);
  if (escapesRoot) {
    throw new Error(`${label} must stay inside the repository workspace`);
  }
}

function assertExtension(
  candidate: string,
  extension: string | undefined,
  label: string
): void {
  if (extension && extname(candidate).toLowerCase() !== extension) {
    throw new Error(`${label} must use the ${extension} extension`);
  }
}

async function resolveRoot(root: string): Promise<string> {
  return realpath(resolve(root));
}

export async function resolveWorkspaceInputPath(
  candidate: string,
  options: WorkspacePathOptions = {}
): Promise<string> {
  const label = options.label ?? 'Input path';
  assertSafeCandidate(candidate, label);
  const root = await resolveRoot(options.root ?? process.cwd());
  const lexicalPath = resolve(root, candidate);
  assertInsideRoot(root, lexicalPath, label);
  assertExtension(lexicalPath, options.extension, label);
  const canonicalPath = await realpath(lexicalPath); // NOSONAR -- lexical containment is enforced before resolving symlinks.
  assertInsideRoot(root, canonicalPath, label);
  return canonicalPath;
}

export async function resolveWorkspaceOutputPath(
  candidate: string,
  options: WorkspacePathOptions = {}
): Promise<string> {
  const label = options.label ?? 'Output path';
  assertSafeCandidate(candidate, label);
  const root = await resolveRoot(options.root ?? process.cwd());
  const lexicalPath = resolve(root, candidate);
  assertInsideRoot(root, lexicalPath, label);
  assertExtension(lexicalPath, options.extension, label);

  try {
    const status = await lstat(lexicalPath); // NOSONAR -- lexical containment is enforced before file-system access.
    if (status.isSymbolicLink()) {
      throw new Error(`${label} must not be a symbolic link`);
    }
    const canonicalPath = await realpath(lexicalPath);
    assertInsideRoot(root, canonicalPath, label);
    return canonicalPath;
  } catch (error) {
    if (
      !(error instanceof Error && 'code' in error && error.code === 'ENOENT')
    ) {
      throw error;
    }
  }

  const canonicalParent = await realpath(dirname(lexicalPath)); // NOSONAR -- the validated parent must exist inside the workspace.
  assertInsideRoot(root, canonicalParent, label);
  return resolve(canonicalParent, basename(lexicalPath));
}
