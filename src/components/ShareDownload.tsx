'use client';

import { useState, type FormEvent } from 'react';

export function ShareDownload({
  token,
  passwordRequired,
  fileName,
}: {
  token: string;
  passwordRequired: boolean;
  fileName: string;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleDownload(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    setDownloading(true);
    try {
      const res = await fetch(`/api/share/${encodeURIComponent(token)}/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(passwordRequired ? { password } : {}),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Download failed.');
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      setError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  if (done) {
    return (
      <p className="text-sm text-emerald-700 dark:text-emerald-400">Download started. You can close this page.</p>
    );
  }

  return (
    <form onSubmit={handleDownload} className="flex flex-col gap-3">
      {passwordRequired && (
        <div className="flex flex-col gap-1">
          <label htmlFor="share-password" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            This file is password protected
          </label>
          <input
            id="share-password"
            type="password"
            required
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={downloading}
        className="rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        {downloading ? 'Downloading…' : 'Download file'}
      </button>
    </form>
  );
}
