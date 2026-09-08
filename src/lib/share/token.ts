import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Generates a cryptographically random share token (256 bits, URL-safe).
 * The raw value is only ever held in memory long enough to build the share
 * URL response — it is never persisted.
 */
export function generateShareToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Deterministic hash used to look up a ShareLink by token. SHA-256 (not a
 * slow password hash) is the right tool here: the input is a high-entropy
 * random token, not a low-entropy human secret, so there's nothing for a
 * slow KDF to protect against beyond what 256 bits of randomness already
 * gives — and a public share-lookup path needs to stay fast.
 */
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Constant-time comparison, kept for any future path that compares hashes directly. */
export function safeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
