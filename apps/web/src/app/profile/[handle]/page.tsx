'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PostCard, type FeedPost, type AccountType } from '@/components/feed/PostCard';
import { usePostReactions, useReactionHandlers } from '@/hooks/usePostReactions';
import { normalizeCounts, type ReactionType } from '@/lib/reactions';
import { MessageCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface ProfileUser {
  _id: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  accountType?: AccountType;
  bio?: string;
}

interface ProfileStats {
  postCount: number;
  followerCount: number;
  followingCount: number;
}

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
      accountType: (author.accountType as AccountType) ?? 'traveler',
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

export default function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const router = useRouter();
  const { user, isLoggedIn } = useAuth();
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [viewerFollowing, setViewerFollowing] = useState(false);
  const [isSelf, setIsSelf] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('posts');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([api.getUserProfile(handle), api.getUserPosts(handle, 20)])
      .then(([p, postData]) => {
        if (!active) return;
        setProfile(p.user as ProfileUser);
        setStats(p.stats as ProfileStats);
        setViewerFollowing(p.viewerFollowing);
        setIsSelf(p.isSelf);
        setPosts(((postData.items as ApiPost[]) ?? []).map(mapPost));
      })
      .catch((e) => {
        if (active) setError((e as Error).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [handle]);

  const toggleFollow = useCallback(async () => {
    if (!profile) return;
    const next = !viewerFollowing;
    setViewerFollowing(next);
    setStats((s) =>
      s
        ? {
            ...s,
            followerCount: Math.max(0, s.followerCount + (next ? 1 : -1)),
          }
        : s,
    );
    try {
      if (next) await api.follow(profile._id);
      else await api.unfollow(profile._id);
    } catch {
      setViewerFollowing(!next);
      setStats((s) =>
        s
          ? {
              ...s,
              followerCount: Math.max(0, s.followerCount + (next ? -1 : 1)),
            }
          : s,
      );
    }
  }, [profile, viewerFollowing]);

  // Optimistic reaction updates + revert, shared with the other post surfaces.
  const { onReact, onUnreact, applyRemoteReaction } = useReactionHandlers(posts, setPosts);

  // Live counts from other viewers. Never touches our own `viewerReaction`.
  const visibleIds = useMemo(() => posts.map((p) => p._id), [posts]);
  usePostReactions(visibleIds, applyRemoteReaction);

  const handleMessage = useCallback(async () => {
    if (!profile) return;
    try {
      const conv = await api.createConversation(profile._id);
      router.push(`/messages?conv=${conv._id}`);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Không thể tạo hội thoại');
    }
  }, [profile, router]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'posts', label: 'Bài viết' },
    { key: 'saved', label: 'Đã lưu' },
    { key: 'trips', label: 'Chuyến đi' },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        {loading && (
          <Card className="p-6">
            <div className="flex animate-pulse items-center gap-4">
              <div className="h-20 w-20 rounded-full bg-surface-3" />
              <div className="flex-1 space-y-3">
                <div className="h-5 w-40 rounded bg-surface-3" />
                <div className="h-3 w-24 rounded bg-surface-3" />
              </div>
            </div>
          </Card>
        )}

        {error && !loading && (
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="text-danger" size={28} aria-hidden />
            <p className="text-sm text-text-muted">{error}</p>
          </Card>
        )}

        {!loading && !error && profile && (
          <>
            {/* Profile header card */}
            <Card className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <Avatar
                    name={profile.displayName}
                    src={profile.avatarUrl}
                    accountType={profile.accountType ?? 'traveler'}
                    size={80}
                  />
                  <div>
                    <h1 className="text-xl font-bold text-text">{profile.displayName}</h1>
                    <p className="text-sm text-text-muted">
                      {profile.handle ? `@${profile.handle}` : 'Người dùng'}
                    </p>
                    {profile.bio && (
                      <p className="mt-1.5 max-w-sm text-sm text-text-muted">{profile.bio}</p>
                    )}
                  </div>
                </div>

                {!isSelf && (
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Button
                      variant={viewerFollowing ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => void toggleFollow()}
                      disabled={!isLoggedIn}
                    >
                      {viewerFollowing ? 'Đang theo dõi' : 'Theo dõi'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleMessage()}
                      disabled={!isLoggedIn}
                    >
                      <MessageCircle size={15} className="mr-1.5" aria-hidden />
                      Nhắn tin
                    </Button>
                  </div>
                )}
              </div>

              {/* Stats row */}
              <div className="mt-5 flex items-center gap-6 border-t border-border pt-4 text-sm">
                <div className="text-center">
                  <p className="font-bold text-text">{stats?.postCount ?? 0}</p>
                  <p className="text-text-muted">bài viết</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-text">{stats?.followerCount ?? 0}</p>
                  <p className="text-text-muted">người theo dõi</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-text">{stats?.followingCount ?? 0}</p>
                  <p className="text-text-muted">đang theo dõi</p>
                </div>
              </div>
            </Card>

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
                {posts.length === 0 ? (
                  <Card className="col-span-full p-8 text-center">
                    <p className="text-sm text-text-muted">Chưa có bài viết nào.</p>
                  </Card>
                ) : (
                  posts.map((post) => (
                    <PostCard
                      key={post._id}
                      post={post}
                      onReact={onReact}
                      onUnreact={onUnreact}
                      onToggleSave={async (id, saved) => {
                        try {
                          await api.savePost(id);
                        } catch {
                          setPosts((prev) =>
                            prev.map((p) =>
                              p._id === id
                                ? {
                                    ...p,
                                    viewerSaved: !saved,
                                    saveCount: Math.max(0, p.saveCount + (saved ? -1 : 1)),
                                  }
                                : p,
                            ),
                          );
                        }
                      }}
                    />
                  ))
                )}
              </div>
            )}

            {activeTab === 'saved' && (
              <Card className="flex flex-col items-center gap-3 p-12 text-center">
                <p className="text-text-muted">Chưa có bài viết nào được lưu.</p>
              </Card>
            )}

            {activeTab === 'trips' && (
              <Card className="flex flex-col items-center gap-3 p-12 text-center">
                <p className="text-text-muted">Chưa có chuyến đi nào được lưu.</p>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}