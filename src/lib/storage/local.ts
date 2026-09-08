import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { StorageAdapter } from './types';

// Storage keys are always generated server-side as 64 lowercase hex
// characters (see lib/files/storage-key.ts) — never derived from user input.
// Enforcing the shape here is defense in depth against path traversal.
const STORAGE_KEY_PATTERN = /^[a-f0-9]{64}$/;

// This adapter is for local development only (see lib/storage/index.ts) —
// production deployments should swap in a Supabase Storage adapter instead
// of relying on serverless-filesystem writes. FILE_STORAGE_PATH is
// dev-configurable, so the join below is intentionally dynamic; the
// turbopackIgnore comments opt this local-only code path out of Turbopack's
// static file-tracing (which would otherwise bundle the whole project).
function resolveBasePath(): string {
  const configured = process.env.FILE_STORAGE_PATH;
  const base = configured && configured.trim() !== '' ? configured : './storage/encrypted';
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), base);
}

function resolveObjectPath(key: string): string {
  if (!STORAGE_KEY_PATTERN.test(key)) {
    throw new Error('Invalid storage key format');
  }
  const base = resolveBasePath();
  const target = path.join(/* turbopackIgnore: true */ base, key);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error('Resolved storage path escapes the storage root');
  }
  return target;
}

export const localStorageAdapter: StorageAdapter = {
  async put(key, data) {
    const base = resolveBasePath();
    await mkdir(base, { recursive: true });
    await writeFile(resolveObjectPath(key), data, { mode: 0o600 });
  },

  async get(key) {
    return readFile(resolveObjectPath(key));
  },

  async delete(key) {
    try {
      await unlink(resolveObjectPath(key));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }
  },
};
