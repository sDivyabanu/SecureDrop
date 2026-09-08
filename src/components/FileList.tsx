'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface FileListItem {
  id: number;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function FileList({ initialFiles }: { initialFiles: FileListItem[] }) {
  const router = useRouter();
  const [files, setFiles] = useState(initialFiles);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(id: number) {
    setError(null);
    setBusyId(id);
    try {
      const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Delete failed');
        return;
      }
      setFiles((prev) => prev.filter((f) => f.id !== id));
      router.refresh();
    } catch {
      setError('Delete failed. Please try again.');
    } finally {
      setBusyId(null);
    }
  }

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-500">
        No files yet. Upload your first file above.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <ul className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {files.map((file) => (
          <li key={file.id} className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">{file.originalName}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-500">
                {file.mimeType} · {formatBytes(file.size)} ·{' '}
                {new Date(file.createdAt).toLocaleDateString()} ·{' '}
                <span className="text-emerald-700 dark:text-emerald-400">encrypted</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <a
                href={`/api/files/${file.id}/download`}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Download
              </a>
              <button
                type="button"
                disabled={busyId === file.id}
                onClick={() => handleDelete(file.id)}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                {busyId === file.id ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
