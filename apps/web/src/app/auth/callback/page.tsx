'use client';

import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function AuthCallbackPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    async function handleCallback() {
      if (!session) {
        router.replace('/login');
        return;
      }

      const s = session as unknown as Record<string, unknown>;
      const accessToken = s.accessToken as string | undefined;
      const refreshToken = s.refreshToken as string | undefined;
      const isNew = s.isNew as boolean | undefined;

      if (!accessToken) {
        router.replace('/login');
        return;
      }

      localStorage.setItem('tvp_token', accessToken);
      if (refreshToken) localStorage.setItem('tvp_refresh', refreshToken);
      document.cookie = `tvp_token=${accessToken}; path=/; max-age=86400; SameSite=Lax`;

      try {
        const { user } = await api.getMe(accessToken);
        localStorage.setItem('tvp_user', JSON.stringify(user));
      } catch {
        // non-blocking
      }

      router.replace(isNew ? '/onboarding?from=google' : '/planner');
    }

    handleCallback();
  }, [session, status, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="flex flex-col items-center gap-3">
        <svg
          className="h-8 w-8 animate-spin text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <p className="text-sm text-text-muted">Đang xử lý đăng nhập…</p>
      </div>
    </div>
  );
}
