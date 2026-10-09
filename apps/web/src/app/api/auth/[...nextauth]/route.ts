import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import type { User } from 'next-auth';

interface TVPUser extends User {
  accessToken?: string;
  refreshToken?: string;
  isNew?: boolean;
}

const handler = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === 'google' && user.email) {
        try {
          // Use internal API URL for server-side calls (avoids relative URL issues in containers)
          const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://api:4000';
          const res = await fetch(`${API_URL}/v1/auth/google`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              name: user.name,
              googleId: account.providerAccountId,
              avatar: user.image,
            }),
          });
          if (res.ok) {
            const data = await res.json() as { accessToken?: string; refreshToken?: string; isNew?: boolean };
            (user as TVPUser).accessToken = data.accessToken;
            (user as TVPUser).refreshToken = data.refreshToken;
            (user as TVPUser).isNew = data.isNew;
          }
        } catch {
          // silently fail — user can still continue
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = (user as TVPUser).accessToken;
        token.refreshToken = (user as TVPUser).refreshToken;
        token.isNew = (user as TVPUser).isNew;
      }
      return token;
    },
    async session({ session, token }) {
      const s = session as unknown as Record<string, unknown>;
      s.accessToken = token.accessToken;
      s.refreshToken = token.refreshToken;
      s.isNew = token.isNew;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});

export { handler as GET, handler as POST };
