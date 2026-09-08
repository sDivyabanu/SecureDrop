/**
 * Storage abstraction for encrypted file objects. Callers pass only
 * server-generated storage keys and already-encrypted bytes — never
 * plaintext, never a user-supplied filename or path.
 */
export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
