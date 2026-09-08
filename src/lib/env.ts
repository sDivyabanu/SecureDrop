import { getMasterKey } from './encryption';

/**
 * Server-startup environment validation. Called once from
 * instrumentation.ts's `register()` — fails fast with a clear, specific
 * error rather than letting a missing/malformed variable surface later as
 * a confusing runtime failure deep in a request handler.
 *
 * Storage-provider selection is validated here directly (nothing else
 * checks it eagerly); ENCRYPTION_MASTER_KEY reuses its one real validator
 * from lib/encryption.ts (getMasterKey) so there's a single source of
 * truth for what a valid key looks like, called both lazily there and
 * eagerly here.
 */
export function validateEnv(): void {
  const errors: string[] = [];

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim() === '') {
    errors.push('DATABASE_URL is not set.');
  }

  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.trim() === '') {
    errors.push(
      'AUTH_SECRET is not set. Generate one with: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }

  try {
    getMasterKey();
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
  }

  const provider = (process.env.FILE_STORAGE_PROVIDER ?? '').trim().toLowerCase();
  if (provider !== '' && provider !== 'local' && provider !== 'supabase') {
    errors.push(`FILE_STORAGE_PROVIDER "${provider}" is invalid — expected "local" or "supabase".`);
  }
  if (provider === 'supabase') {
    if (!process.env.SUPABASE_URL) errors.push('FILE_STORAGE_PROVIDER=supabase requires SUPABASE_URL.');
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      errors.push('FILE_STORAGE_PROVIDER=supabase requires SUPABASE_SERVICE_ROLE_KEY.');
    }
  }

  // Never let a NEXT_PUBLIC_*-prefixed variable carry a server secret name —
  // catches the mistake at startup instead of after it's already shipped to
  // the browser bundle.
  for (const key of Object.keys(process.env)) {
    if (/^NEXT_PUBLIC_.*(SECRET|SERVICE_ROLE|PRIVATE_KEY|MASTER_KEY)/i.test(key)) {
      errors.push(`${key} looks like a server secret but is NEXT_PUBLIC_-prefixed, which ships it to the browser.`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment configuration:\n- ${errors.join('\n- ')}`);
  }
}
