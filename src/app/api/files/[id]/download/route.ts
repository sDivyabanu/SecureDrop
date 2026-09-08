import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/prisma/db';
import { storage } from '@/lib/storage';
import { decryptBuffer, decodeEncryptionMetadata } from '@/lib/encryption';
import { sanitizeForContentDisposition } from '@/lib/files/validation';

export const runtime = 'nodejs';

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const ownerId = Number(session.user.id);

  const { id: idParam } = await context.params;
  const id = Number(idParam);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Ownership enforced in the query, not just checked after the fact.
  const file = await db.orm.public.File.where((f) => f.id.eq(id))
    .where((f) => f.ownerId.eq(ownerId))
    .first();

  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  let plaintext: Buffer;
  try {
    const ciphertext = await storage.get(file.storageKey);
    const metadata = decodeEncryptionMetadata({
      iv: file.encryptionIv,
      authTag: file.encryptionAuthTag,
      salt: file.encryptionSalt,
    });
    // Throws if the AES-GCM authentication tag doesn't verify — caught
    // below and reported as a safe, generic error. Never serve partial or
    // unauthenticated plaintext.
    plaintext = decryptBuffer({ ciphertext, ...metadata });
  } catch (err) {
    console.error('File retrieval/decryption failed', {
      fileId: id,
      error: err instanceof Error ? err.message : err,
    });
    return NextResponse.json({ error: 'Unable to retrieve file' }, { status: 500 });
  }

  const safeName = sanitizeForContentDisposition(file.originalName);

  return new NextResponse(new Uint8Array(plaintext), {
    status: 200,
    headers: {
      'Content-Type': file.mimeType,
      'Content-Disposition': `attachment; filename="${safeName}"`,
      'Content-Length': String(plaintext.length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
