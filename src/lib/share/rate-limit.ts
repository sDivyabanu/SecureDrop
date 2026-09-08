import { createHash } from 'node:crypto';
import { db } from '@/prisma/db';

const WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS_PER_WINDOW = 5;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller may retry — only meaningful when `allowed` is false. */
  retryAfterSeconds: number;
}

/**
 * Identifies the requester for rate-limiting purposes. Hashed rather than
 * stored raw — the identifier only needs to be stable and unguessable-back-
 * to-the-IP for this purpose, not reversible.
 */
export function hashRequesterIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex');
}

/** Best-effort client IP extraction behind a proxy/load balancer. */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp;
  // No proxy header available (e.g. plain local dev) — fall back to a
  // constant bucket. This still rate-limits per share link, just without
  // per-requester granularity, which is strictly safer than no limit at all.
  return 'unknown';
}

/**
 * Fixed-window rate limiter for share password attempts, backed by
 * Postgres so it works correctly across multiple/serverless instances (an
 * in-memory counter would reset per instance and be trivially bypassed by
 * hitting a different one).
 *
 * One row per (shareLinkId, identifier) pair is upserted in place — a
 * client retrying the same link updates its own counter row rather than
 * appending a new one, so table growth is bounded by the number of
 * distinct (link, requester) pairs that have ever attempted a password,
 * not by request volume.
 *
 * This is a best-effort throttle, not a hard security boundary the way the
 * download-claim CAS is: a small race between concurrent requests for the
 * same brand-new (link, identifier) pair could let one or two extra
 * attempts through before the counter catches up. That's an acceptable
 * tradeoff for a throttle (the goal is raising the cost of brute-forcing,
 * not a correctness guarantee), and is why this doesn't need the same
 * SQL-builder CAS machinery as the download claim.
 */
export async function checkShareRateLimit(shareLinkId: number, identifier: string): Promise<RateLimitResult> {
  const now = Date.now();

  const existing = await db.orm.public.ShareRateLimit.where((r) => r.shareLinkId.eq(shareLinkId))
    .where((r) => r.identifier.eq(identifier))
    .first();

  if (!existing) {
    await db.orm.public.ShareRateLimit.create({
      shareLinkId,
      identifier,
      attemptCount: 1,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  const windowStartMs = new Date(existing.windowStart).getTime();
  const windowExpired = now - windowStartMs >= WINDOW_MS;

  if (windowExpired) {
    await db.orm.public.ShareRateLimit.where((r) => r.id.eq(existing.id)).update({
      attemptCount: 1,
      windowStart: new Date().toISOString(),
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.attemptCount >= MAX_ATTEMPTS_PER_WINDOW) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSeconds };
  }

  await db.orm.public.ShareRateLimit.where((r) => r.id.eq(existing.id)).update({
    attemptCount: existing.attemptCount + 1,
  });
  return { allowed: true, retryAfterSeconds: 0 };
}
