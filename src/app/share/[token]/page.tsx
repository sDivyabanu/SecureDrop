import { getPublicShareInfo } from '@/lib/share/access';
import { ShareDownload } from '@/components/ShareDownload';

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

const BLOCK_MESSAGES: Record<string, string> = {
  REVOKED: 'This share link has been revoked.',
  EXPIRED: 'This share link has expired.',
  DOWNLOAD_LIMIT_REACHED: 'This share link has reached its download limit.',
};

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const info = await getPublicShareInfo(token);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">SecureDrop share</h1>

        {!info ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            This link is invalid or no longer exists.
          </p>
        ) : info.blocked ? (
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">{BLOCK_MESSAGES[info.blocked]}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <p className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">{info.originalName}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                {info.mimeType} · {formatBytes(info.size)}
              </p>
              {info.expiresAt && (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
                  Expires {new Date(info.expiresAt).toLocaleString()}
                </p>
              )}
              <p className="mt-2 flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400">
                <span aria-hidden="true">🔒</span>
                Encrypted with AES-256-GCM — decrypted only for this download.
              </p>
            </div>

            <ShareDownload token={token} passwordRequired={info.passwordRequired} fileName={info.originalName} />
          </div>
        )}
      </div>
    </div>
  );
}
