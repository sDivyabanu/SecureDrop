'use client';

import { useEffect, useState, type FormEvent } from 'react';

interface ShareLinkSummary {
  id: number;
  expiresAt: string | null;
  maxDownloads: number | null;
  downloadCount: number;
  oneTimeDownload: boolean;
  isActive: boolean;
  createdAt: string;
}

function describeRestrictions(link: ShareLinkSummary): string {
  const parts: string[] = [];
  parts.push(link.oneTimeDownload ? 'One-time download' : `${link.downloadCount} download${link.downloadCount === 1 ? '' : 's'}`);
  if (link.maxDownloads !== null) parts.push(`limit ${link.maxDownloads}`);
  if (link.expiresAt) parts.push(`expires ${new Date(link.expiresAt).toLocaleString()}`);
  if (!link.isActive) parts.push('revoked');
  return parts.join(' · ');
}

export function ShareManager({ fileId }: { fileId: number }) {
  const [shares, setShares] = useState<ShareLinkSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [password, setPassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [maxDownloads, setMaxDownloads] = useState('');
  const [oneTimeDownload, setOneTimeDownload] = useState(false);

  async function loadShares() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/share`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Unable to load share links');
        return;
      }
      setShares(data.shareLinks);
    } catch {
      setError('Unable to load share links');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Fetch-on-mount/fileId-change: setLoading/setShares run after the fetch
    // resolves, not synchronously in the effect body, but the lint rule
    // can't see through the loadShares indirection — safe to disable here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadShares();
  }, [fileId]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    setCreatedUrl(null);
    try {
      const body: Record<string, unknown> = { oneTimeDownload };
      if (usePassword && password) body.password = password;
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      if (maxDownloads) body.maxDownloads = Number(maxDownloads);

      const res = await fetch(`/api/files/${fileId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Unable to create share link');
        return;
      }
      setCreatedUrl(data.shareLink.url);
      setPassword('');
      setUsePassword(false);
      setExpiresAt('');
      setMaxDownloads('');
      setOneTimeDownload(false);
      await loadShares();
    } catch {
      setError('Unable to create share link');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(shareId: number) {
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}/share/${shareId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Unable to revoke link');
        return;
      }
      await loadShares();
    } catch {
      setError('Unable to revoke link');
    }
  }

  async function handleCopy() {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — the URL is still shown as selectable text.
    }
  }

  return (
    <div className="mt-3 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      {createdUrl && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950">
          <p className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
            Share link created — copy it now. It won&apos;t be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <input
              readOnly
              value={createdUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded border border-emerald-300 bg-white px-2 py-1 text-xs text-zinc-950 dark:border-emerald-800 dark:bg-zinc-950 dark:text-zinc-50"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="shrink-0 rounded-md border border-emerald-300 px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-900"
            >
              {copied ? 'Copied' : 'Copy link'}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-col gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Create a share link
        </p>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={usePassword} onChange={(e) => setUsePassword(e.target.checked)} />
            Password protect
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={oneTimeDownload}
              onChange={(e) => setOneTimeDownload(e.target.checked)}
            />
            One-time download
          </label>
        </div>

        {usePassword && (
          <input
            type="password"
            placeholder="Share password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={4}
            required={usePassword}
            className="rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
          />
        )}

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            Expires (optional)
            <input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-950 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-zinc-600 dark:text-zinc-400">
            Max downloads (optional)
            <input
              type="number"
              min={1}
              value={maxDownloads}
              onChange={(e) => setMaxDownloads(e.target.value)}
              disabled={oneTimeDownload}
              className="w-28 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-950 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-50"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={creating}
          className="w-fit rounded-md bg-zinc-950 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {creating ? 'Creating…' : 'Create share link'}
        </button>
      </form>

      <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Active links
        </p>
        {loading ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">Loading…</p>
        ) : !shares || shares.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">No share links yet.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {shares.map((link) => (
              <li key={link.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-700 dark:text-zinc-300">{describeRestrictions(link)}</span>
                {link.isActive ? (
                  <button
                    type="button"
                    onClick={() => handleRevoke(link.id)}
                    className="shrink-0 rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    Revoke
                  </button>
                ) : (
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-600">revoked</span>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-600">
          Only the token&apos;s hash is stored — a link&apos;s full URL is shown once, at creation, and can&apos;t be
          recovered afterward. Revoke and create a new one if it&apos;s lost.
        </p>
      </div>
    </div>
  );
}
