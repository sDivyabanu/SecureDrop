import { localStorageAdapter } from './local';
import { supabaseStorageAdapter } from './supabase';
import type { StorageAdapter } from './types';

type StorageProvider = 'local' | 'supabase';

function resolveProvider(): StorageProvider {
  const configured = (process.env.FILE_STORAGE_PROVIDER ?? '').trim().toLowerCase();
  if (configured === '' || configured === 'local') return 'local';
  if (configured === 'supabase') return 'supabase';
  throw new Error(`Unknown FILE_STORAGE_PROVIDER "${configured}" — expected "local" or "supabase".`);
}

const provider = resolveProvider();

if (provider === 'local' && process.env.NODE_ENV === 'production') {
  // Not fatal (some self-hosted deployments genuinely do have persistent
  // disk), but local filesystem storage silently loses every file on most
  // serverless/production platforms — worth a loud warning rather than a
  // silent footgun.
  console.warn(
    'FILE_STORAGE_PROVIDER is "local" (or unset) in a production build. ' +
      'Local filesystem storage does not persist on most serverless/production platforms. ' +
      'Set FILE_STORAGE_PROVIDER=supabase (with SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ' +
      'SUPABASE_STORAGE_BUCKET) for durable storage.',
  );
}

// Single seam for swapping storage backends: encrypted objects on the local
// filesystem for development, or a private Supabase Storage bucket for
// production — selected via FILE_STORAGE_PROVIDER. Either way, callers only
// ever see opaque encrypted bytes under random keys.
export const storage: StorageAdapter = provider === 'supabase' ? supabaseStorageAdapter : localStorageAdapter;

export type { StorageAdapter };
