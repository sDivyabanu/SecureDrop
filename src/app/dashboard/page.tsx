import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { db } from '@/prisma/db';
import { UploadForm } from '@/components/UploadForm';
import { FileList } from '@/components/FileList';
import { LogoutButton } from '@/components/LogoutButton';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const ownerId = Number(session.user.id);

  const files = await db.orm.public.File.select(
    'id',
    'originalName',
    'mimeType',
    'size',
    'createdAt',
  )
    .where((f) => f.ownerId.eq(ownerId))
    .orderBy((f) => f.createdAt.desc())
    .all();

  const serializedFiles = files.map((file) => ({
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: Number(file.size),
    createdAt: file.createdAt,
  }));

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-lg font-semibold text-zinc-950 dark:text-zinc-50">SecureDrop</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{session.user.email}</p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-6 py-8">
        <section
          aria-label="Security status"
          className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
        >
          <span aria-hidden="true">🔒</span>
          Files are encrypted with AES-256-GCM before storage. Only you can decrypt your files.
        </section>

        <section aria-labelledby="upload-heading">
          <h2 id="upload-heading" className="mb-3 text-base font-semibold text-zinc-950 dark:text-zinc-50">
            Upload a file
          </h2>
          <UploadForm />
        </section>

        <section aria-labelledby="files-heading">
          <h2 id="files-heading" className="mb-3 text-base font-semibold text-zinc-950 dark:text-zinc-50">
            My files
          </h2>
          <FileList initialFiles={serializedFiles} />
        </section>
      </main>
    </div>
  );
}
