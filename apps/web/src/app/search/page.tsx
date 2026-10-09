'use client';

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { useSearch, type SearchTab } from '@/hooks/useSearch';
import { useLocale, t } from '@/lib/i18n';
import { cn } from '@/lib/cn';
import { UserResult } from './UserResult';
import { PostResult } from './PostResult';
import { PlaceResult } from './PlaceResult';

function SearchContent() {
  const params = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const q = params.get('q') ?? '';
  const tab = (params.get('tab') ?? 'all') as SearchTab;
  const state = useSearch(q, tab);

  const tabs: { key: SearchTab; label: string }[] = [
    { key: 'all', label: t(locale, 'search.tabs.all') },
    { key: 'posts', label: t(locale, 'search.tabs.posts') },
    { key: 'users', label: t(locale, 'search.tabs.users') },
    { key: 'places', label: t(locale, 'search.tabs.places') },
  ];

  function setTab(key: SearchTab) {
    router.push(`/search?q=${encodeURIComponent(q)}&tab=${key}`);
  }

  const hasResults =
    state.users.length > 0 || state.posts.length > 0 || state.places.length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        {q && (
          <p className="mb-4 text-sm text-text-muted">
            {t(locale, 'search.resultsFor')}{' '}
            <span className="font-medium text-text">"{q}"</span>
          </p>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b border-border">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors',
                tab === key
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-text-muted hover:text-text',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Loading skeleton */}
        {state.loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-surface-2 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!state.loading && q && !hasResults && (
          <div className="py-12 text-center">
            <p className="text-text-muted">{t(locale, 'search.empty')}</p>
            <p className="mt-1 text-sm text-text-muted">{t(locale, 'search.emptyHint')}</p>
          </div>
        )}

        {/* All tab — top 3 of each category */}
        {!state.loading && tab === 'all' && hasResults && (
          <div className="space-y-6">
            {state.users.length > 0 && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t(locale, 'search.tabs.users')}
                  </h2>
                  {state.users.length >= 3 && (
                    <button
                      onClick={() => setTab('users')}
                      className="text-xs text-primary hover:underline"
                    >
                      Xem tất cả
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {state.users.slice(0, 3).map((u) => (
                    <UserResult key={u._id} user={u} />
                  ))}
                </div>
              </section>
            )}

            {state.posts.length > 0 && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t(locale, 'search.tabs.posts')}
                  </h2>
                  {state.posts.length >= 3 && (
                    <button
                      onClick={() => setTab('posts')}
                      className="text-xs text-primary hover:underline"
                    >
                      Xem tất cả
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {state.posts.slice(0, 3).map((p) => (
                    <PostResult key={p.id} post={p} />
                  ))}
                </div>
              </section>
            )}

            {state.places.length > 0 && (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                    {t(locale, 'search.tabs.places')}
                  </h2>
                  {state.places.length >= 3 && (
                    <button
                      onClick={() => setTab('places')}
                      className="text-xs text-primary hover:underline"
                    >
                      Xem tất cả
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {state.places.slice(0, 3).map((p) => (
                    <PlaceResult key={p._id} place={p} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Posts tab */}
        {!state.loading && tab === 'posts' && (
          <div className="space-y-2">
            {state.posts.map((p) => (
              <PostResult key={p.id} post={p} />
            ))}
          </div>
        )}

        {/* Users tab */}
        {!state.loading && tab === 'users' && (
          <div className="space-y-2">
            {state.users.map((u) => (
              <UserResult key={u._id} user={u} />
            ))}
          </div>
        )}

        {/* Places tab */}
        {!state.loading && tab === 'places' && (
          <div className="space-y-2">
            {state.places.map((p) => (
              <PlaceResult key={p._id} place={p} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchContent />
    </Suspense>
  );
}
