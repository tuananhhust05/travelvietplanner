'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { AppShell } from '@/components/layout/AppShell';
import { Composer, type ComposerPayload } from '@/components/feed/Composer';
import { PostCard, type FeedPost } from '@/components/feed/PostCard';
import { usePostReactions, useReactionHandlers } from '@/hooks/usePostReactions';
import { normalizeCounts, type ReactionType } from '@/lib/reactions';
import { TrendingRail } from '@/components/feed/TrendingRail';
import { SuggestedFollows } from '@/components/feed/SuggestedFollows';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { t, useLocale } from '@/lib/i18n';
import { ProfileCompletenessBanner } from '@/components/profile/ProfileCompletenessBanner';

/** Shape returned by the API feed endpoint. */
interface ApiPost {
  _id: string;
  body: string;
  lang?: string;
  createdAt?: string;
  media?: { url: string; type: 'image' | 'video' }[];
  place?: { name: string; lat?: number; lng?: number } | null;
  address?: { commune: string; province: string; label: string } | null;
  likeCount?: number;
  commentCount?: number;
  saveCount?: number;
  viewerLiked?: boolean;
  viewerSaved?: boolean;
  /** Absent when the API predates the reactions deploy. */
  reactions?: unknown;
  reactionsTotal?: number;
  viewerReaction?: ReactionType | null;
  serviceId?: string;
  listingId?: string;
  author?: {
    _id?: string;
    displayName?: string;
    handle?: string;
    avatarUrl?: string;
    accountType?: string;
  };
}

const GRADIENTS = [
  'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600',
  'bg-gradient-to-br from-emerald-500 via-teal-600 to-slate-700',
  'bg-gradient-to-br from-sky-400 via-cyan-500 to-blue-700',
  'bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-700',
];

function mapPost(p: ApiPost, i: number): FeedPost {
  const author = p.author ?? {};
  return {
    _id: p._id,
    body: p.body,
    lang: p.lang,
    createdAt: p.createdAt,
    author: {
      _id: author._id,
      name: author.displayName || 'Người dùng travelvietplaner',
      handle: author.handle ? `@${author.handle}` : '@traveler',
      accountType: (author.accountType as FeedPost['author']['accountType']) ?? 'traveler',
      avatarUrl: author.avatarUrl,
    },
    cover: GRADIENTS[i % GRADIENTS.length],
    media: p.media ?? [],
    place: p.place ?? null,
    address: p.address ?? null,
    tags: [],
    likeCount: p.likeCount ?? p.reactionsTotal ?? 0,
    commentCount: p.commentCount ?? 0,
    saveCount: p.saveCount ?? 0,
    viewerLiked: p.viewerLiked ?? false,
    viewerSaved: p.viewerSaved ?? false,
    // Safe fallbacks: the API may deploy before this web build.
    reactions: normalizeCounts(p.reactions),
    reactionsTotal: Math.max(0, p.reactionsTotal ?? p.likeCount ?? 0),
    viewerReaction: p.viewerReaction ?? null,
    serviceId: p.serviceId,
    listingId: p.listingId,
  };
}

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const locale = useLocale();

  const load = useCallback(async (reset = true) => {
    if (reset) {
      setStatus('loading');
      setError(null);
    } else {
      setLoadingMore(true);
    }
    try {
      const data = await api.feed(20, reset ? undefined : nextCursor ?? undefined);
      const items = (data.items as ApiPost[]) ?? [];
      const mapped = items.map(mapPost);
      setPosts((prev) => (reset ? mapped : [...prev, ...mapped]));
      setNextCursor(data.nextCursor);
      setStatus('ready');
    } catch (e) {
      if (reset) {
        setError((e as Error).message);
        setStatus('error');
      }
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor]);

  useEffect(() => {
    setToken(localStorage.getItem('tvp_token'));
    void load(true);
  }, []);

  // Infinite scroll — load more when the sentinel enters the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) {
          void load(false);
        }
      },
      { rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [nextCursor, loadingMore, load]);

  const handlePost = useCallback(
    async (payload: ComposerPayload) => {
      if (!token) throw new Error(t(locale, 'planner.loginNeeded'));
      await api.createPost(
        {
          body: payload.body,
          lang: locale,
          media: payload.media.length > 0 ? payload.media : undefined,
          place: payload.place ?? undefined,
        },
        token,
      );
      await load(true);
    },
    [token, load, locale],
  );

  // Optimistic reaction updates + revert, shared with the other post surfaces.
  const { onReact, onUnreact, applyRemoteReaction } = useReactionHandlers(posts, setPosts);

  // Live counts from other viewers. Never touches our own `viewerReaction`.
  const visibleIds = useMemo(() => posts.map((p) => p._id), [posts]);
  usePostReactions(visibleIds, applyRemoteReaction);

  const handleToggleSave = useCallback(async (id: string, saved: boolean) => {
    try {
      await api.savePost(id);
    } catch {
      setPosts((prev) =>
        prev.map((p) =>
          p._id === id
            ? { ...p, viewerSaved: !saved, saveCount: Math.max(0, p.saveCount + (saved ? -1 : 1)) }
            : p,
        ),
      );
    }
  }, []);

  return (
    <AppShell>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* CENTER — composer + feed */}
        <div className="flex flex-col gap-4">
          <h1 className="sr-only">{t(locale, 'feed.title')}</h1>
          <Composer onSubmit={handlePost} token={token} locale={locale} />

          {token && <ProfileCompletenessBanner variant="dismissible" />}

          {status === 'loading' && (
            <div className="flex flex-col gap-4" aria-hidden>
              {[0, 1, 2].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <Skeleton className="aspect-[16/10] w-full rounded-none" />
                  <div className="space-y-3 p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                  </div>
                </Card>
              ))}
            </div>
          )}

          {status === 'error' && (
            <Card className="flex flex-col items-center gap-3 p-8 text-center">
              <AlertCircle className="text-danger" size={28} aria-hidden />
              <p className="text-sm text-text-muted">{error}</p>
              <Button variant="outline" onClick={() => void load(true)}>
                {t(locale, 'common.retry')}
              </Button>
            </Card>
          )}

          {status === 'ready' && posts.length === 0 && (
            <Card className="p-8 text-center">
              <p className="text-pretty text-sm text-text-muted">
                {t(locale, 'feed.empty')}
              </p>
            </Card>
          )}

          {status === 'ready' &&
            posts.map((post) => (
              <PostCard
                key={post._id}
                post={post}
                locale={locale}
                onReact={onReact}
                onUnreact={onUnreact}
                onToggleSave={handleToggleSave}
              />
            ))}

          {/* Infinite scroll sentinel */}
          <div ref={sentinelRef} className="h-1" aria-hidden />
          {loadingMore && (
            <div className="flex justify-center py-4 text-text-muted">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
            </div>
          )}
        </div>

        {/* RIGHT rail — desktop only */}
        <aside className="hidden flex-col gap-4 lg:flex">
          <div className="sticky top-[80px] flex max-h-[calc(100vh-80px)] flex-col gap-4 overflow-y-auto pr-1">
            <TrendingRail />
            <SuggestedFollows locale={locale} />
          </div>
        </aside>
      </div>
    </AppShell>
  );
}