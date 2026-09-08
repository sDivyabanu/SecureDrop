import NextAuth from 'next-auth';
import { NextResponse } from 'next/server';
import { authConfig } from '@/auth.config';

// Next.js 16 Proxy (formerly Middleware) defaults to the Node.js runtime, so
// importing the full src/auth.ts (database client, native argon2 binding)
// would actually work here today. This file still builds its own minimal
// `auth` from the provider-free authConfig so the route-protection check
// stays cheap (no DB/crypto deps) and keeps working if this ever needs to
// run on the Edge runtime instead.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const isProtectedPage = pathname.startsWith('/dashboard');
  const isProtectedApi = pathname.startsWith('/api/files');

  if ((isProtectedPage || isProtectedApi) && !isLoggedIn) {
    if (isProtectedApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ['/dashboard/:path*', '/api/files/:path*'],
};
