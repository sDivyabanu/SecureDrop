'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const ACCEPTED = '.pdf,.txt,.docx,.png,.jpg,.jpeg,.zip';

export function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const file = inputRef.current?.files?.[0];
    if (!file) {
      setError('Choose a file first');
      return;
    }
    if (file.size === 0) {
      setError('File is empty');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError('File exceeds the 25 MB maximum');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/files', { method: 'POST', body: formData });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error ?? 'Upload failed');
        return;
      }

      if (inputRef.current) inputRef.current.value = '';
      router.refresh();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-lg border border-dashed border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-950"
    >
      <label htmlFor="file" className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        Choose a file to encrypt and upload
      </label>
      <input
        ref={inputRef}
        id="file"
        name="file"
        type="file"
        accept={ACCEPTED}
        className="text-sm text-zinc-700 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-950 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white dark:text-zinc-300 dark:file:bg-zinc-50 dark:file:text-zinc-950"
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-500">
        Allowed: PDF, TXT, DOCX, PNG, JPG, ZIP. Maximum 25 MB.
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={uploading}
        className="w-fit rounded-md bg-zinc-950 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        {uploading ? 'Encrypting & uploading…' : 'Upload'}
      </button>
    </form>
  );
}
