import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/prisma/db';

export const runtime = 'nodejs';

const HISTORY_LIMIT = 50;

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const ownerId = Number(session.user.id);

  const { id: idParam } = await context.params;
  const fileId = Number(idParam);
  if (!Number.isInteger(fileId) || fileId <= 0) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Ownership check on the File itself before ever touching its download
  // history — a history list is never returned for a file that isn't ours.
  const file = await db.orm.public.File.where((f) => f.id.eq(fileId))
    .where((f) => f.ownerId.eq(ownerId))
    .first();
  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  // Only safe, display-appropriate fields: status, timestamp, and the
  // share link's numeric id as a display reference. Never tokenHash,
  // passwordHash, encryption metadata, or requester IP information.
  const logs = await db.orm.public.DownloadLog.select('id', 'status', 'shareLinkId', 'createdAt')
    .where((d) => d.fileId.eq(fileId))
    .orderBy((d) => d.createdAt.desc())
    .limit(HISTORY_LIMIT)
    .all();

  return NextResponse.json({
    ok: true,
    history: logs.map((log) => ({
      id: log.id,
      status: log.status,
      shareLinkId: log.shareLinkId,
      createdAt: log.createdAt,
    })),
  });
}
