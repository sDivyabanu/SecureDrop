export async function register() {
  // Env validation needs Node's process.env in a plain server context —
  // skip on the Edge runtime (Proxy) where this file also loads.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('./lib/env');
    validateEnv();
  }
}
