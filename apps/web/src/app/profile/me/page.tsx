'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ChevronRight } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PostCard, type FeedPost } from '@/components/feed/PostCard';
import { usePostReactions, useReactionHandlers } from '@/hooks/usePostReactions';
import { normalizeCounts, type ReactionType } from '@/lib/reactions';
import { ProfileCompletenessBanner } from '@/components/profile/ProfileCompletenessBanner';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Trip {
  id: string;
  title: string;
  destination: string | null;
  startDate: string;
  endDate: string;
  dayCount: number;
  createdAt: string;
}

function formatTripDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const ACCOUNT_LABEL: Record<string, string> = {
  traveler: 'Người du lịch',
  agency: 'Đơn vị lữ hành',
  business: 'Nhà hàng / Khách sạn',
  guide: 'Hướng dẫn viên',
};

const GRADIENTS = [
  'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600',
  'bg-gradient-to-br from-emerald-500 via-teal-600 to-slate-700',
  'bg-gradient-to-br from-sky-400 via-cyan-500 to-blue-700',
  'bg-gradient-to-br from-violet-500 via-purple-600 to-fuchsia-700',
];

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

type Tab = 'posts' | 'saved' | 'trips';

export default function MyProfilePage() {
  const router = useRouter();
  const { user, isLoggedIn, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [stats, setStats] = useState<{ postCount: number; followerCount: number; followingCount: number } | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  // Trips state
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripsStatus, setTripsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const data = await api.myPosts(50);
      setPosts(((data.items as ApiPost[]) ?? []).map(mapPost));
      setStats(data.stats ?? null);
      setStatus('ready');
    } catch (e) {
      setError((e as Error).message);
      setStatus('error');
    }
  }, []);

  const loadTrips = useCallback(async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('tvp_token') : null;
    if (!token) return;
    setTripsStatus('loading');
    try {
      const res = await fetch(`${api.base}/v1/trips`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Trip[];
      setTrips(data);
      setTripsStatus('ready');
    } catch {
      setTripsStatus('error');
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isLoggedIn) {
      router.replace('/login');
      return;
    }
    void load();
  }, [authLoading, isLoggedIn, router, load]);

  useEffect(() => {
    if (activeTab === 'trips' && tripsStatus === 'idle') {
      void loadTrips();
    }
  }, [activeTab, tripsStatus, loadTrips]);

  // Optimistic reaction updates + revert, shared with the other post surfaces.
  // Declared before the early return below so hook order stays stable.
  const { onReact, onUnreact, applyRemoteReaction } = useReactionHandlers(posts, setPosts);

  // Live counts from other viewers. Never touches our own `viewerReaction`.
  const visibleIds = useMemo(() => posts.map((p) => p._id), [posts]);
  usePostReactions(visibleIds, applyRemoteReaction);

  // PostCard updates its own bookmark optimistically; without this the request
  // is never sent and the state resets on reload. Same wiring as the feed.
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

  const tabs: { key: Tab; label: string }[] = [
    { key: 'posts', label: 'Bài viết' },
    { key: 'saved', label: 'Đã lưu' },
    { key: 'trips', label: 'Chuyến đi' },
  ];

  if (authLoading || !user) {
    return (
      <AppShell>
        <div className="mx-auto max-w-2xl space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          </Card>
        </div>
      </AppShell>
    );
  }

  const displayName = user.displayName || 'Người dùng';
  const handle = user.handle ? `@${user.handle}` : '@traveler';
  const accountLabel = ACCOUNT_LABEL[user.activeProfileType] ?? 'Người du lịch';

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Profile header card */}
        <Card className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar name={displayName} src={user.avatarUrl} accountType={user.activeProfileType} size={80} />
              <div>
                <h1 className="text-xl font-bold text-text">{displayName}</h1>
                <p className="text-sm text-text-muted">{handle}</p>
                <span className="mt-1.5 inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {accountLabel}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/settings/account')}>
              Chỉnh sửa hồ sơ
            </Button>
          </div>

          {/* Stats row */}
          <div className="mt-5 flex items-center gap-6 border-t border-border pt-4 text-sm">
            <div className="text-center">
              <p className="font-bold text-text">{stats?.postCount ?? '–'}</p>
              <p className="text-text-muted">bài viết</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-text">{stats?.followerCount ?? '–'}</p>
              <p className="text-text-muted">người theo dõi</p>
            </div>
            <div className="text-center">
              <p className="font-bold text-text">{stats?.followingCount ?? '–'}</p>
              <p className="text-text-muted">đang theo dõi</p>
            </div>
          </div>
        </Card>

        {/* Profile completeness banner */}
        <ProfileCompletenessBanner variant="inline" />

        {/* Tab bar */}
        <div className="flex rounded-xl border border-border bg-surface-1 p-1">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex-1 rounded-lg py-2 text-sm font-medium transition-colors duration-base',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                activeTab === key
                  ? 'bg-primary text-primary-fg shadow-e1'
                  : 'text-text-muted hover:text-text',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'posts' && (
          <div className="grid gap-4 md:grid-cols-2">
            {status === 'loading' && (
              <>
                {[0, 1].map((i) => (
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
              </>
            )}

            {status === 'error' && (
              <Card className="flex flex-col items-center gap-3 p-8 text-center md:col-span-2">
                <AlertCircle className="text-danger" size={28} aria-hidden />
                <p className="text-sm text-text-muted">{error}</p>
                <Button variant="outline" onClick={() => void load()}>
                  Thử lại
                </Button>
              </Card>
            )}

            {status === 'ready' && posts.length === 0 && (
              <Card className="p-8 text-center md:col-span-2">
                <p className="text-pretty text-sm text-text-muted">
                  Bạn chưa có bài viết nào. Hãy chia sẻ chuyến đi đầu tiên của bạn!
                </p>
              </Card>
            )}

            {status === 'ready' &&
              posts.map((post) => (
                <PostCard
                  key={post._id}
                  post={post}
                  onReact={onReact}
                  onUnreact={onUnreact}
                />
              ))}
          </div>
        )}

        {activeTab === 'saved' && (
          <Card className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-text-muted">Chưa có bài viết nào được lưu.</p>
          </Card>
        )}

        {activeTab === 'trips' && (
          <div className="space-y-3">
            {tripsStatus === 'loading' && (
              <>
                {[0, 1, 2].map((i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="mb-2 h-4 w-48" />
                    <Skeleton className="h-3 w-32" />
                  </Card>
                ))}
              </>
            )}

            {tripsStatus === 'error' && (
              <Card className="flex flex-col items-center gap-3 p-8 text-center">
                <AlertCircle className="text-danger" size={28} aria-hidden />
                <p className="text-sm text-text-muted">Không thể tải chuyến đi.</p>
                <Button variant="outline" onClick={() => { setTripsStatus('idle'); void loadTrips(); }}>
                  Thử lại
                </Button>
              </Card>
            )}

            {tripsStatus === 'ready' && trips.length === 0 && (
              <Card className="p-8 text-center">
                <p className="text-sm text-text-muted">Chưa có chuyến đi nào. Hãy thử lên kế hoạch tại trang Planner!</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => router.push('/planner')}>
                  Đến trang Planner
                </Button>
              </Card>
            )}

            {tripsStatus === 'ready' && trips.map((trip) => (
              <Card
                key={trip.id}
                className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-surface-2"
                onClick={() => router.push(`/trips/${trip.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text">{trip.title}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {formatTripDate(trip.startDate)} → {formatTripDate(trip.endDate)}
                    {trip.destination ? ` · ${trip.destination}` : ''}
                    {' · '}{trip.dayCount} ngày
                  </p>
                </div>
                <ChevronRight className="ml-3 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}