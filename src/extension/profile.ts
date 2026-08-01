import { access, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const PROFILE_DIRECTORY_PATTERN = /^Profile (?<number>\d+)$/u;

async function containsExtension(
  userDataDir: string,
  profile: string,
  extensionId: string
): Promise<boolean> {
  try {
    await access(join(userDataDir, profile, 'Extensions', extensionId));
    return true;
  } catch {
    return false;
  }
}

async function lastUsedProfile(
  userDataDir: string
): Promise<string | undefined> {
  try {
    const state = JSON.parse(
      await readFile(join(userDataDir, 'Local State'), 'utf8')
    ) as { profile?: { last_used?: unknown } };
    return typeof state.profile?.last_used === 'string'
      ? state.profile.last_used
      : undefined;
  } catch {
    return;
  }
}

function profileOrder(left: string, right: string): number {
  if (left === 'Default') {
    return right === 'Default' ? 0 : -1;
  }
  if (right === 'Default') {
    return 1;
  }
  const leftNumber = Number(
    PROFILE_DIRECTORY_PATTERN.exec(left)?.groups?.number
  );
  const rightNumber = Number(
    PROFILE_DIRECTORY_PATTERN.exec(right)?.groups?.number
  );
  return leftNumber - rightNumber || left.localeCompare(right);
}

export async function findExtensionProfile(
  userDataDir: string,
  extensionId: string
): Promise<string | undefined> {
  const entries = await readdir(userDataDir, { withFileTypes: true }).catch(
    () => []
  );
  const profiles = entries
    .filter(
      (entry) =>
        entry.isDirectory() &&
        (entry.name === 'Default' || PROFILE_DIRECTORY_PATTERN.test(entry.name))
    )
    .map((entry) => entry.name)
    .sort(profileOrder);
  const lastUsed = await lastUsedProfile(userDataDir);
  const ordered = lastUsed
    ? [lastUsed, ...profiles.filter((profile) => profile !== lastUsed)]
    : profiles;
  const availability = await Promise.all(
    ordered.map(async (profile) => ({
      profile,
      available: await containsExtension(userDataDir, profile, extensionId),
    }))
  );
  return availability.find((entry) => entry.available)?.profile;
}
