import type { NextAuthConfig } from 'next-auth';

/**
 * Edge-safe NextAuth config: no providers with server-only dependencies
 * (database client, native argon2 binding) so this file can be imported by
 * `middleware.ts`, which runs on the Edge runtime. The real Credentials
 * provider (with its `authorize` callback) is added in `src/auth.ts`,
 * which is only imported from Route Handlers and Server Components.
 */
export const authConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && typeof token.id === 'string') {
        session.user.id = token.id;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
