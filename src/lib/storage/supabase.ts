import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StorageAdapter } from './types';

// Storage keys are always generated server-side as 64 lowercase hex
// characters (see lib/files/storage-key.ts) — never derived from user input.
const STORAGE_KEY_PATTERN = /^[a-f0-9]{64}$/;

const DEFAULT_BUCKET = 'securedrop-files';

let cachedClient: SupabaseClient | null = null;

/**
 * Lazily builds the service-role Supabase client on first use (not at
 * module import time), so importing this file doesn't require the env vars
 * to be set unless this adapter is actually selected. The service-role key
 * never leaves the server — this client is only ever constructed here, in
 * server-only code, and its key is read straight from `process.env`.
 */
function getClient(): SupabaseClient {
  if (cachedClient) return cachedClient;

  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'FILE_STORAGE_PROVIDER=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to be set.',
    );
  }

  cachedClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

function getBucket(): string {
  const configured = process.env.SUPABASE_STORAGE_BUCKET;
  return configured && configured.trim() !== '' ? configured : DEFAULT_BUCKET;
}

function assertValidKey(key: string): void {
  if (!STORAGE_KEY_PATTERN.test(key)) {
    throw new Error('Invalid storage key format');
  }
}

/**
 * Supabase Storage adapter. Deals only in opaque encrypted bytes under
 * random server-generated keys — it makes no encryption/authorization
 * decisions of its own (those live in lib/encryption.ts and the route
 * handlers). The bucket this points at MUST be private: this adapter never
 * generates a public or signed URL: every read goes through `download()`
 * with the service-role key, fetching bytes server-side so they can be
 * decrypted and authorized by SecureDrop before ever reaching a client.
 */
export const supabaseStorageAdapter: StorageAdapter = {
  async put(key, data) {
    assertValidKey(key);
    const { error } = await getClient()
      .storage.from(getBucket())
      .upload(key, data, {
        // Objects are always opaque ciphertext under a random key with no
        // filename — there is nothing meaningful to infer a content type
        // from, and no reason to let Supabase try.
        contentType: 'application/octet-stream',
        upsert: false,
      });
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
  },

  async get(key) {
    assertValidKey(key);
    const { data, error } = await getClient().storage.from(getBucket()).download(key);
    if (error || !data) {
      throw new Error(`Supabase Storage download failed: ${error?.message ?? 'no data returned'}`);
    }
    return Buffer.from(await data.arrayBuffer());
  },

  async delete(key) {
    assertValidKey(key);
    const { error } = await getClient().storage.from(getBucket()).remove([key]);
    if (error) throw new Error(`Supabase Storage delete failed: ${error.message}`);
  },
};
