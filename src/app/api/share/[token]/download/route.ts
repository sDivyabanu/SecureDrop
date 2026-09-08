import { NextResponse } from 'next/server';
import { db } from '@/prisma/db';
import { storage } from '@/lib/storage';
import { decryptBuffer, decodeEncryptionMetadata } from '@/lib/encryption';
import { sanitizeForContentDisposition } from '@/lib/files/validation';
import { verifyPassword } from '@/lib/auth/password';
import { findShareLinkByToken, evaluateShareBlock, claimShareLinkDownload } from '@/lib/share/access';
import { logDownloadAttempt } from '@/lib/share/download-log';

export const runtime = 'nodejs';

const GENERIC_UNAVAILABLE = { error: 'This link is unavailable.' } as const;

function messageForBlock(reason: 'REVOKED' | 'EXPIRED' | 'DOWNLOAD_LIMIT_REACHED'): string {
  switch (reason) {
    case 'REVOKED':
      return 'This share link has been revoked.';
    case 'EXPIRED':
      return 'This share link has expired.';
    case 'DOWNLOAD_LIMIT_REACHED':
      return 'This share link has reached its download limit.';
  }
}

export async function POST(req: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!token || typeof token !== 'string') {
    return NextResponse.json(GENERIC_UNAVAILABLE, { status: 404 });
  }

  // Unknown/malformed tokens: no ShareLink row exists to hash-match against,
  // so there is nothing to attach a DownloadLog entry to — the schema is
  // not weakened just to force a log row for a request that never
  // resolved to a real share.
  const link = await findShareLinkByToken(token);
  if (!link) {
    return NextResponse.json(GENERIC_UNAVAILABLE, { status: 404 });
  }

  const preCheckBlock = evaluateShareBlock(link);
  if (preCheckBlock) {
    await logDownloadAttempt(link.fileId, link.id, preCheckBlock);
    return NextResponse.json({ error: messageForBlock(preCheckBlock) }, { status: 410 });
  }

  if (link.passwordHash) {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const password = typeof body === 'object' && body !== null && 'password' in body ? (body as { password?: unknown }).password : undefined;

    if (typeof password !== 'string' || password.length === 0 || !(await verifyPassword(link.passwordHash, password))) {
      await logDownloadAttempt(link.fileId, link.id, 'INVALID_PASSWORD');
      // Generic message — never reveals whether the link itself is valid
      // vs. the password specifically was wrong beyond "incorrect password".
      return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
    }
  }

  const file = await db.orm.public.File.where((f) => f.id.eq(link.fileId)).first();
  if (!file) {
    // Unreachable in practice (File cascade-deletes its ShareLinks), kept
    // as a safe fallback rather than an unhandled throw.
    await logDownloadAttempt(link.fileId, link.id, 'INTEGRITY_FAILED');
    return NextResponse.json(GENERIC_UNAVAILABLE, { status: 500 });
  }

  let plaintext: Buffer;
  try {
    const ciphertext = await storage.get(file.storageKey);
    const metadata = decodeEncryptionMetadata({
      iv: file.encryptionIv,
      authTag: file.encryptionAuthTag,
      salt: file.encryptionSalt,
    });
    // Throws on a bad AES-GCM auth tag — caught below, never returns
    // partial/unauthenticated plaintext.
    plaintext = decryptBuffer({ ciphertext, ...metadata });
  } catch (err) {
    console.error('Share download decryption failed', {
      shareLinkId: link.id,
      fileId: file.id,
      error: err instanceof Error ? err.message : err,
    });
    await logDownloadAttempt(link.fileId, link.id, 'INTEGRITY_FAILED');
    return NextResponse.json({ error: 'Unable to retrieve file.' }, { status: 500 });
  }

  // Claim the download slot only after a successful decrypt, so
  // downloadCount tracks genuinely successful deliveries. The
  // compare-and-swap retry loop (see claimShareLinkDownload) is what
  // actually prevents concurrent requests from exceeding a one-time or
  // max-download limit — the checks above are precondition checks, not the
  // enforcement point.
  const claim = await claimShareLinkDownload(link.id);
  if (!claim.ok) {
    await logDownloadAttempt(link.fileId, link.id, claim.reason);
    return NextResponse.json({ error: messageForBlock(claim.reason) }, { status: 410 });
  }

  await logDownloadAttempt(link.fileId, link.id, 'SUCCESS');

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
