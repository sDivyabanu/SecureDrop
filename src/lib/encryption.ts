import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const CIPHER_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const HKDF_INFO = Buffer.from('securedrop-file-key-v1');

let cachedMasterKey: Buffer | null = null;

/**
 * Loads and validates ENCRYPTION_MASTER_KEY. Not called at module import
 * time, so builds/tooling that never touch encryption don't need the
 * variable set — but exported so instrumentation.ts's startup check can
 * call it eagerly and fail fast on a missing/malformed key instead of
 * waiting for the first upload/download to hit it. Throws a clear,
 * non-sensitive error either way.
 */
export function getMasterKey(): Buffer {
  if (cachedMasterKey) return cachedMasterKey;

  const raw = process.env.ENCRYPTION_MASTER_KEY;
  if (!raw || raw.trim() === '') {
    throw new Error(
      'ENCRYPTION_MASTER_KEY is not set. Generate one with: ' +
        'node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"',
    );
  }

  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new Error('ENCRYPTION_MASTER_KEY is not valid base64.');
  }

  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_MASTER_KEY must decode to exactly ${KEY_LENGTH} bytes (a base64-encoded ` +
        `256-bit key); decoded to ${key.length} bytes instead.`,
    );
  }

  cachedMasterKey = key;
  return key;
}

function deriveFileKey(masterKey: Buffer, salt: Buffer): Buffer {
  return Buffer.from(hkdfSync('sha256', masterKey, salt, HKDF_INFO, KEY_LENGTH));
}

export interface EncryptedPayload {
  ciphertext: Buffer;
  iv: Buffer;
  authTag: Buffer;
  salt: Buffer;
}

export interface EncryptionMetadata {
  iv: string;
  authTag: string;
  salt: string;
}

/** Encrypts a plaintext buffer with AES-256-GCM under a fresh, per-file derived key. */
export function encryptBuffer(plaintext: Buffer): EncryptedPayload {
  const masterKey = getMasterKey();
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const fileKey = deriveFileKey(masterKey, salt);

  try {
    const cipher = createCipheriv(CIPHER_ALGORITHM, fileKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return { ciphertext, iv, authTag, salt };
  } finally {
    fileKey.fill(0);
  }
}

/**
 * Decrypts a ciphertext buffer, verifying the AES-GCM authentication tag.
 * Throws if the tag doesn't verify (tampered/corrupted ciphertext or wrong
 * metadata) — callers must treat any throw here as "abort, do not serve".
 */
export function decryptBuffer(payload: EncryptedPayload): Buffer {
  const masterKey = getMasterKey();
  const fileKey = deriveFileKey(masterKey, payload.salt);

  try {
    const decipher = createDecipheriv(CIPHER_ALGORITHM, fileKey, payload.iv);
    decipher.setAuthTag(payload.authTag);
    return Buffer.concat([decipher.update(payload.ciphertext), decipher.final()]);
  } finally {
    fileKey.fill(0);
  }
}

export function encodeEncryptionMetadata(payload: Pick<EncryptedPayload, 'iv' | 'authTag' | 'salt'>): EncryptionMetadata {
  return {
    iv: payload.iv.toString('base64'),
    authTag: payload.authTag.toString('base64'),
    salt: payload.salt.toString('base64'),
  };
}

export function decodeEncryptionMetadata(metadata: EncryptionMetadata): Pick<EncryptedPayload, 'iv' | 'authTag' | 'salt'> {
  return {
    iv: Buffer.from(metadata.iv, 'base64'),
    authTag: Buffer.from(metadata.authTag, 'base64'),
    salt: Buffer.from(metadata.salt, 'base64'),
  };
}
