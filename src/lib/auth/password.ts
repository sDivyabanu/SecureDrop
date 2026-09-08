import { hash, verify } from '@node-rs/argon2';

// `Algorithm` is a `const enum` in @node-rs/argon2's types, which can't be
// imported under this project's `isolatedModules` setting — 2 is
// `Algorithm.Argon2id`. OWASP-recommended minimums for Argon2id
// (2023 cheat sheet): m=19 MiB, t=2, p=1.
const ARGON2_OPTIONS = {
  algorithm: 2,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    // Malformed/foreign hash — treat as a failed verification, never throw
    // through to the caller (which would otherwise leak hash-format details).
    return false;
  }
}
