import { NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import { db } from '@/prisma/db';
import { hashPassword } from '@/lib/auth/password';
import { generateShareToken, hashShareToken } from '@/lib/share/token';
import { parseJsonBody } from '@/lib/http/json-body';

export const runtime = 'nodejs';

const createShareSchema = z.object({
  expiresAt: z.string().datetime().optional().nullable(),
  password: z.string().min(4).max(200).optional().nullable(),
  maxDownloads: z.number().int().positive().optional().nullable(),
  oneTimeDownload: z.boolean().optional(),
});

async function getOwnedFile(fileId: number, ownerId: number) {
  return db.orm.public.File.where((f) => f.id.eq(fileId))
    .where((f) => f.ownerId.eq(ownerId))
    .first();
}

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

  // Ownership check happens on the File itself, before we ever look at its
  // share links — a share list is never returned for a file that isn't ours.
  const file = await getOwnedFile(fileId, ownerId);
  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const links = await db.orm.public.ShareLink.select(
    'id',
    'expiresAt',
    'maxDownloads',
    'downloadCount',
    'oneTimeDownload',
    'isActive',
    'createdAt',
  )
    .where((s) => s.fileId.eq(fileId))
    .orderBy((s) => s.createdAt.desc())
    .all();

  // tokenHash / passwordHash are never selected above, so there is nothing
  // to accidentally leak here — the browser only ever sees the columns
  // listed in `.select(...)`.
  return NextResponse.json({
    ok: true,
    shareLinks: links.map((l) => ({
      id: l.id,
      expiresAt: l.expiresAt,
      maxDownloads: l.maxDownloads,
      downloadCount: l.downloadCount,
      oneTimeDownload: l.oneTimeDownload,
      isActive: l.isActive,
      createdAt: l.createdAt,
    })),
  });
}

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
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

  // Never allow a user to create a share link for a file they don't own —
  // enforced by filtering the lookup on ownerId, not by checking after.
  const file = await getOwnedFile(fileId, ownerId);
  if (!file) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }

  const parsed = createShareSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid share options' }, { status: 400 });
  }
  const { expiresAt, password, maxDownloads, oneTimeDownload } = parsed.data;

  if (expiresAt) {
    const expiryDate = new Date(expiresAt);
    if (expiryDate.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Expiration must be in the future' }, { status: 400 });
    }
  }

  const token = generateShareToken();
  const tokenHash = hashShareToken(token);
  const passwordHash = password ? await hashPassword(password) : null;

  const created = await db.orm.public.ShareLink.select(
    'id',
    'expiresAt',
    'maxDownloads',
    'downloadCount',
    'oneTimeDownload',
    'isActive',
    'createdAt',
  ).create({
    fileId,
    tokenHash,
    passwordHash,
    expiresAt: expiresAt ?? null,
    maxDownloads: maxDownloads ?? null,
    oneTimeDownload: oneTimeDownload ?? false,
  });

  const shareUrl = new URL(`/share/${token}`, req.url).toString();

  // The raw token is only ever present in this one response — it is not
  // retrievable again after this, by design (only tokenHash is stored).
  return NextResponse.json(
    {
      ok: true,
      shareLink: {
        id: created.id,
        url: shareUrl,
        expiresAt: created.expiresAt,
        maxDownloads: created.maxDownloads,
        downloadCount: created.downloadCount,
        oneTimeDownload: created.oneTimeDownload,
        isActive: created.isActive,
        createdAt: created.createdAt,
      },
    },
    { status: 201 },
  );
}
