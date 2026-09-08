import { localStorageAdapter } from './local';
import type { StorageAdapter } from './types';

// Single seam for swapping storage backends. Today: encrypted objects on the
// local filesystem under FILE_STORAGE_PATH. For production on Vercel/serverless
// (no persistent local disk), point this at a Supabase Storage private-bucket
// adapter instead — see the README note in PART F of the phase report for the
// manual Supabase configuration this would require.
export const storage: StorageAdapter = localStorageAdapter;

export type { StorageAdapter };
