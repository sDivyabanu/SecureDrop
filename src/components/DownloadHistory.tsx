'use client';

import { useEffect, useState } from 'react';

interface HistoryEntry {
  id: number;
  status: string;
  shareLinkId: number;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  SUCCESS: 'text-emerald-700 dark:text-emerald-400',
  INVALID_PASSWORD: 'text-red-700 dark:text-red-400',
  EXPIRED: 'text-zinc-500 dark:text-zinc-500',
  DOWNLOAD_LIMIT_REACHED: 'text-zinc-500 dark:text-zinc-500',
  REVOKED: 'text-zinc-500 dark:text-zinc-500',
  INTEGRITY_FAILED: 'text-red-700 dark:text-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  SUCCESS: 'Downloaded',
  INVALID_PASSWORD: 'Wrong password',
  EXPIRED: 'Blocked (expired)',
  DOWNLOAD_LIMIT_REACHED: 'Blocked (limit reached)',
  REVOKED: 'Blocked (revoked)',
  INTEGRITY_FAILED: 'Failed (integrity check)',
};

export function DownloadHistory({ fileId }: { fileId: number }) {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/files/${fileId}/history`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? 'Unable to load download history');
          return;
        }
        setEntries(data.history);
      } catch {
        if (!cancelled) setError('Unable to load download history');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  return (
    <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Recent download activity
      </p>

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {!error && entries === null && <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">Loading…</p>}

      {entries && entries.length === 0 && (
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">No download attempts yet.</p>
      )}

      {entries && entries.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
              <span className={STATUS_STYLES[entry.status] ?? 'text-zinc-700 dark:text-zinc-300'}>
                {STATUS_LABELS[entry.status] ?? entry.status}
              </span>
              <span className="text-xs text-zinc-500 dark:text-zinc-500">
                Share #{entry.shareLinkId} · {new Date(entry.createdAt).toLocaleString('en-US')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
