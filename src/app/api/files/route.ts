import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/prisma/db';
import { encryptBuffer, encodeEncryptionMetadata } from '@/lib/encryption';
import { validateUpload, MAX_FILE_SIZE_BYTES } from '@/lib/files/validation';
import { generateStorageKey } from '@/lib/files/storage-key';
import { storage } from '@/lib/storage';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const ownerId = Number(session.user.id);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Malformed upload' }, { status: 400 });
  }

  const uploaded = formData.get('file');
  if (!(uploaded instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }
  if (uploaded.size === 0) {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 });
  }
  if (uploaded.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: 'File exceeds the 25 MB maximum' }, { status: 413 });
  }

  const buffer = Buffer.from(await uploaded.arrayBuffer());

  // Never trust the client-supplied name/extension/MIME type for the
  // accept/reject decision — validateUpload sniffs actual file content.
  const validation = await validateUpload(buffer, uploaded.name);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  let encrypted;
  try {
    encrypted = encryptBuffer(buffer);
  } catch (err) {
    console.error('Encryption failed during upload', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Unable to process file' }, { status: 500 });
  }

  const storageKey = generateStorageKey();

  try {
    await storage.put(storageKey, encrypted.ciphertext);
  } catch (err) {
    console.error('Storage write failed during upload', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Unable to store file' }, { status: 500 });
  }

  const metadata = encodeEncryptionMetadata(encrypted);

  try {
    const record = await db.orm.public.File.select('id', 'originalName', 'mimeType', 'size', 'createdAt').create({
      ownerId,
      originalName: validation.sanitizedName,
      storageKey,
      mimeType: validation.mimeType,
      size: BigInt(buffer.length),
      encryptionIv: metadata.iv,
      encryptionAuthTag: metadata.authTag,
      encryptionSalt: metadata.salt,
    });

    return NextResponse.json(
      {
        ok: true,
        file: {
          id: record.id,
          originalName: record.originalName,
          mimeType: record.mimeType,
          size: Number(record.size),
          createdAt: record.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    // Roll back the orphaned encrypted object if the metadata write failed.
    await storage.delete(storageKey).catch(() => {});
    console.error('Database write failed during upload', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Unable to save file metadata' }, { status: 500 });
  }
}
