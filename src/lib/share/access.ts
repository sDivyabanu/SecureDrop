import { db } from '@/prisma/db';
import { hashShareToken } from './token';

export type ShareBlockReason = 'REVOKED' | 'EXPIRED' | 'DOWNLOAD_LIMIT_REACHED';

export interface ShareLinkRecord {
  id: number;
  fileId: number;
  tokenHash: string;
  passwordHash: string | null;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  oneTimeDownload: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface PublicShareInfo {
  shareLinkId: number;
  fileId: number;
  originalName: string;
  mimeType: string;
  size: number;
  passwordRequired: boolean;
  expiresAt: string | null;
  blocked: ShareBlockReason | null;
}

function isExpired(link: Pick<ShareLinkRecord, 'expiresAt'>): boolean {
  return link.expiresAt !== null && new Date(link.expiresAt).getTime() <= Date.now();
}

function isLimitReached(link: Pick<ShareLinkRecord, 'oneTimeDownload' | 'maxDownloads' | 'downloadCount'>): boolean {
  if (link.oneTimeDownload && link.downloadCount >= 1) return true;
  if (link.maxDownloads !== null && link.downloadCount >= link.maxDownloads) return true;
  return false;
}

/** The single source of truth for why a link would currently be blocked, checked in priority order. */
export function evaluateShareBlock(link: ShareLinkRecord): ShareBlockReason | null {
  if (!link.isActive) return 'REVOKED';
  if (isExpired(link)) return 'EXPIRED';
  if (isLimitReached(link)) return 'DOWNLOAD_LIMIT_REACHED';
  return null;
}

export async function findShareLinkByToken(token: string): Promise<ShareLinkRecord | null> {
  const tokenHash = hashShareToken(token);
  const link = await db.orm.public.ShareLink.where((s) => s.tokenHash.eq(tokenHash)).first();
  return link ?? null;
}

/** Read-only lookup for rendering the public share page — never logs, never claims a download. */
export async function getPublicShareInfo(token: string): Promise<PublicShareInfo | null> {
  const link = await findShareLinkByToken(token);
  if (!link) return null;

  const file = await db.orm.public.File.select('id', 'originalName', 'mimeType', 'size')
    .where((f) => f.id.eq(link.fileId))
    .first();
  if (!file) return null;

  return {
    shareLinkId: link.id,
    fileId: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: Number(file.size),
    passwordRequired: link.passwordHash !== null,
    expiresAt: link.expiresAt,
    blocked: evaluateShareBlock(link),
  };
}

export type ClaimResult = { ok: true } | { ok: false; reason: ShareBlockReason };

/**
 * Atomically claims one download slot on a share link.
 *
 * Each attempt re-reads the row, rejects immediately if it's blocked, then
 * issues a compare-and-swap UPDATE guarded on `downloadCount` and
 * `isActive` matching exactly what was just read. This goes through the
 * SQL builder lane (`db.sql`), not the ORM's `.where(...).update(...)`
 * chain: the ORM mutation path was verified (empirically, under real
 * concurrent load) to NOT apply its chained `.where()` predicates as a
 * single atomic conditional UPDATE — concurrent callers guarding on the
 * same stale value could each believe they'd won, silently collapsing into
 * one write. The SQL builder's `.update(...).where(...).returning(...)`
 * compiles to one real parameterized `UPDATE ... WHERE ... RETURNING`
 * statement, which Postgres does serialize correctly: a losing UPDATE's
 * WHERE clause is re-evaluated against the row's just-committed values
 * before it applies, so two requests racing on the same `downloadCount`
 * can never both win.
 *
 * The retry loop (not just a single CAS) is what makes this correct for
 * `maxDownloads > 1`: under N simultaneous requests, a single-shot CAS
 * would let only one of them ever win (they'd all read the same starting
 * `downloadCount` and only the first commit would match), starving the
 * other slots even though the limit hadn't been reached. Retrying with a
 * fresh read after losing a race lets contenders keep claiming slots until
 * the limit is actually hit.
 */
export async function claimShareLinkDownload(shareLinkId: number, maxAttempts = 10): Promise<ClaimResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const link = await db.orm.public.ShareLink.where((s) => s.id.eq(shareLinkId)).first();
    if (!link) return { ok: false, reason: 'REVOKED' };

    const block = evaluateShareBlock(link);
    if (block) return { ok: false, reason: block };

    const plan = db.sql.public.shareLink
      .update({ downloadCount: link.downloadCount + 1 })
      .where((f, fns) =>
        fns.and(
          fns.eq(f.id, shareLinkId),
          fns.eq(f.downloadCount, link.downloadCount),
          fns.eq(f.isActive, true),
        ),
      )
      .returning('id')
      .build();
    const result = await db.runtime().execute(plan);

    if (result.affectedRows > 0) return { ok: true };
    // Lost the race to a concurrent claim on this exact downloadCount — retry with a fresh read.
  }
  return { ok: false, reason: 'DOWNLOAD_LIMIT_REACHED' };
}
