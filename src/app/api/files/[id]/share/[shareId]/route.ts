import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/prisma/db';

export const runtime = 'nodejs';

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string; shareId: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const ownerId = Number(session.user.id);

  const { id: idParam, shareId: shareIdParam } = await context.params;
  const fileId = Number(idParam);
  const shareId = Number(shareIdParam);
  if (!Number.isInteger(fileId) || fileId <= 0 || !Number.isInteger(shareId) || shareId <= 0) {
    return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
  }

  // Ownership is verified by joining through the File the share link
  // belongs to — never by trusting fileId/shareId alone. A share link that
  // exists but belongs to another user's file resolves to the same 404 as
  // one that doesn't exist at all.
  const file = await db.orm.public.File.where((f) => f.id.eq(fileId))
    .where((f) => f.ownerId.eq(ownerId))
    .first();
  if (!file) {
    return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
  }

  const link = await db.orm.public.ShareLink.where((s) => s.id.eq(shareId))
    .where((s) => s.fileId.eq(fileId))
    .first();
  if (!link) {
    return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
  }

  // Soft-revoke: flip isActive rather than deleting, so DownloadLog history
  // for this link (and any sibling share links on the same file) is
  // untouched and the file itself is never affected.
  await db.orm.public.ShareLink.where((s) => s.id.eq(shareId))
    .where((s) => s.fileId.eq(fileId))
    .update({ isActive: false });

  return NextResponse.json({ ok: true });
}
