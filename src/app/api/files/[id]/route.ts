import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/prisma/db';
import { storage } from '@/lib/storage';

export const runtime = 'nodejs';

export async function DELETE(_req: Request, context: { params: Promise<{ id: string }> }) {
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

  // Ownership is enforced in the query itself, not just checked after the
  // fact — a file ID alone is never sufficient to act on it.
  const file = await db.orm.public.File.where((f) => f.id.eq(id))
    .where((f) => f.ownerId.eq(ownerId))
    .first();

  if (!file) {
    // Same response whether the file doesn't exist or belongs to someone
    // else — don't leak which case it is.
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Delete the database record first: it is the source of truth for what
  // the user can see. If storage cleanup below fails, the row is already
  // gone and the (now-unreachable, undecryptable without its metadata)
  // ciphertext object is an orphan rather than a dangling reference.
  try {
    await db.orm.public.File.where((f) => f.id.eq(id))
      .where((f) => f.ownerId.eq(ownerId))
      .delete();
  } catch (err) {
    console.error('Database delete failed', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Unable to delete file' }, { status: 500 });
  }

  try {
    await storage.delete(file.storageKey);
  } catch (err) {
    // Non-fatal: the file is already gone from the user's perspective.
    // Logged so an orphaned ciphertext object isn't silently lost track of.
    console.error('Storage delete failed after DB delete (orphaned object)', {
      fileId: id,
      error: err instanceof Error ? err.message : err,
    });
  }

  return NextResponse.json({ ok: true });
}
