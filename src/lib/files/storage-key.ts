import { randomBytes } from 'node:crypto';

/** A cryptographically random, non-predictable storage identifier — never derived from user input. */
export function generateStorageKey(): string {
  return randomBytes(32).toString('hex');
}
