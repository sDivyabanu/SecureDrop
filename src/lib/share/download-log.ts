import { db } from '@/prisma/db';

export type DownloadStatus =
  | 'SUCCESS'
  | 'INVALID_PASSWORD'
  | 'EXPIRED'
  | 'DOWNLOAD_LIMIT_REACHED'
  | 'REVOKED'
  | 'INTEGRITY_FAILED';

/**
 * Records a download attempt. Only ever called once a ShareLink has been
 * found (fileId/shareLinkId are required, non-null columns) — for a token
 * that matches no ShareLink at all, there is nothing to attach a log row
 * to, and the schema stays as-is rather than being loosened to force one.
 */
export async function logDownloadAttempt(
  fileId: number,
  shareLinkId: number,
  status: DownloadStatus,
): Promise<void> {
  try {
    await db.orm.public.DownloadLog.create({ fileId, shareLinkId, status });
  } catch (err) {
    // Logging must never block or fail the download response itself.
    console.error('Failed to record download log', {
      fileId,
      shareLinkId,
      status,
      error: err instanceof Error ? err.message : err,
    });
  }
}
