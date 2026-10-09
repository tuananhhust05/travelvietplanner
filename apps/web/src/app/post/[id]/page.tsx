'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MessageCircle,
  Bookmark,
  MapPin,
  ArrowLeft,
  AlertCircle,
  Globe,
  Clock,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { CommentThread } from '@/components/post/CommentThread';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/cn';
import { type Locale } from '@/lib/i18n';
import { api } from '@/lib/api';
import { placeLabel } from '@/lib/place';
import type { AccountType } from '@/components/feed/PostCard';
import { ReactionBar } from '@/components/feed/ReactionBar';
import { ReactionSummary } from '@/components/feed/ReactionSummary';
import { ReactionListModal } from '@/components/feed/ReactionListModal';
import { usePostReactions, type OnRemoteReaction } from '@/hooks/usePostReactions';
import { ShareButton } from '@/components/post/ShareButton';
import { ShareToUserModal } from '@/components/post/ShareToUserModal';
import {
  applyReactionChange,
  normalizeCounts,
  EMPTY_REACTION_COUNTS,
  type ReactionCounts,
  type ReactionType,
} from '@/lib/reactions';

const LOCALE: Locale = 'vi';

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
  author?: {
    _id?: string;
    displayName?: string;
    handle?: string;
    avatarUrl?: string;
    accountType?: string;
  };
}

function timeAgo(iso: string | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return LOCALE === 'vi' ? `${mins} phút trước` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return LOCALE === 'vi' ? `${hrs} giờ trước` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return LOCALE === 'vi' ? `${days} ngày trước` : `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** The three reaction values that must always move together. */
interface ReactionState {
  counts: ReactionCounts;
  total: number;
  viewer: ReactionType | null;
}

const INITIAL_REACTION: ReactionState = {
  counts: EMPTY_REACTION_COUNTS,
  total: 0,
  viewer: null,
};

function profileHref(author: ApiPost['author']): string {
  const handle = author?.handle?.replace(/^@/, '');
  if (handle && handle !== 'traveler') return `/profile/${handle}`;
  if (author?._id) return `/profile/${author._id}`;
  return '#';
}

export default function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [post, setPost] = useState<ApiPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  // One object, not three useStates: the optimistic snapshot, the API response and
  // the revert all have to move together, and three separate setters cannot be read
  // back consistently by a second click in the same render flush.
  const [reaction, setReaction] = useState<ReactionState>(INITIAL_REACTION);
  const [listOpen, setListOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // Owned here, not read from `post`: the thread reports its own creates and
  // deletes (including other viewers' arriving over the socket) and this row
  // has to follow them.
  const [commentCount, setCommentCount] = useState(0);

  // Assigned during render, so a burst of clicks reads the value the previous
  // click wrote instead of the pre-update closure (which double-counted).
  const reactionRef = useRef(reaction);
  reactionRef.current = reaction;
  // Per-post request counter: only the newest request may write its response.
  const seqRef = useRef(0);

  const writeReaction = useCallback((next: ReactionState) => {
    reactionRef.current = next;
    setReaction(next);
  }, []);

  const { counts, total, viewer: viewerReaction } = reaction;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .getPost(id)
      .then((p) => {
        if (!active) return;
        const data = p as ApiPost;
        setPost(data);
        setSaved(data.viewerSaved ?? false);
        setCommentCount(Math.max(0, data.commentCount ?? 0));
        // Safe fallbacks: the API may deploy before this web build.
        writeReaction({
          counts: normalizeCounts(data.reactions),
          total: Math.max(0, data.reactionsTotal ?? data.likeCount ?? 0),
          viewer: data.viewerReaction ?? null,
        });
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
  }, [id]);

  /**
   * Snapshot → optimistic via `applyReactionChange` → API → overwrite with the
   * server's absolute counts → revert to the snapshot on error.
   */
  const changeReaction = useCallback(
    async (next: ReactionType | null) => {
      // Read through the ref, not the render closure: two clicks in one flush
      // would otherwise both start from the same base and each apply a delta.
      const snapshot = reactionRef.current;
      if (snapshot.viewer === next) return;

      const seq = seqRef.current + 1;
      seqRef.current = seq;

      const optimistic = applyReactionChange(
        snapshot.counts,
        snapshot.total,
        snapshot.viewer,
        next,
      );
      writeReaction({ counts: optimistic.counts, total: optimistic.total, viewer: next });

      try {
        const res = next ? await api.setReaction(id, next) : await api.removeReaction(id);
        // Superseded by a newer click: that request owns the final state. Without
        // this, like → love → remove lets whichever resolves LAST win and the
        // button visibly flips back to a stale reaction.
        if (seqRef.current !== seq) return;
        writeReaction({
          counts: normalizeCounts(res.counts),
          total: Math.max(0, res.total),
          viewer: res.viewerReaction ?? null,
        });
      } catch {
        if (seqRef.current !== seq) return;
        writeReaction(snapshot);
      }
    },
    [id, writeReaction],
  );

  // Live counts from other viewers. Never touches our own `viewerReaction`.
  const subscribeIds = useMemo(() => (post ? [id] : []), [post, id]);
  const applyRemote = useCallback<OnRemoteReaction>(
    (postId, nextCounts, nextTotal) => {
      if (postId !== id) return;
      // Counts only — `viewer` is our own state and is never broadcast.
      writeReaction({ ...reactionRef.current, counts: nextCounts, total: nextTotal });
    },
    [id, writeReaction],
  );
  usePostReactions(subscribeIds, applyRemote);

  const toggleSave = async () => {
    const next = !saved;
    setSaved(next);
    try {
      await api.savePost(id);
    } catch {
      setSaved(!next);
    }
  };

  const author = post?.author ?? {};
  const authorName = author.displayName || 'Người dùng travelvietplaner';
  const authorType = (author.accountType as AccountType) ?? 'traveler';
  const placeName = placeLabel(post?.place, post?.address);

  const media = post?.media ?? [];
  const hasMedia = media.length > 0;

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-4">
        {/* Back */}
        <Link
          href="/feed"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={16} aria-hidden />
          {LOCALE === 'vi' ? 'Về bảng tin' : 'Back to feed'}
        </Link>

        {loading && (
          <Card className="p-5">
            <div className="flex animate-pulse items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-surface-3" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-surface-3" />
                <div className="h-3 w-24 rounded bg-surface-3" />
              </div>
            </div>
            <div className="mt-4 aspect-[16/10] w-full animate-pulse rounded-xl bg-surface-3" />
          </Card>
        )}

        {error && !loading && (
          <Card className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="text-danger" size={28} aria-hidden />
            <p className="text-sm text-text-muted">{error}</p>
            <Link href="/feed" className="text-sm font-medium text-primary hover:underline">
              {LOCALE === 'vi' ? 'Về bảng tin' : 'Back to feed'}
            </Link>
          </Card>
        )}

        {!loading && !error && post && (
          <>
            {/* Post card — Facebook style.
                No `overflow-hidden` here: the reaction picker in the action bar is
                positioned `absolute bottom-full` and is wider than the column it
                sits in, so a clipping ancestor cuts it off. The media block below
                carries the clipping instead. */}
            <Card className="p-0">
              {/* Author row */}
              <header className="flex items-center gap-3 p-4">
                <Link
                  href={profileHref(author)}
                  className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar name={authorName} src={author.avatarUrl} accountType={authorType} size={44} />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    href={profileHref(author)}
                    className="block truncate text-[15px] font-semibold text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    {authorName}
                  </Link>
                  <p className="flex items-center gap-1.5 truncate text-xs text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} aria-hidden />
                      {timeAgo(post.createdAt)}
                    </span>
                    <span aria-hidden>·</span>
                    <Globe size={11} aria-hidden />
                  </p>
                </div>
              </header>

              {/* Caption */}
              {post.body && (
                <p className="whitespace-pre-wrap px-4 pb-3 text-pretty text-[15px] leading-relaxed text-text">
                  {post.body}
                </p>
              )}

              {/* Media */}
              {hasMedia ? (
                <div className="overflow-hidden bg-surface-2">
                  {media.length === 1 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={media[0].url}
                      alt={post.body}
                      className="max-h-[560px] w-full object-cover"
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-0.5">
                      {media.map((m, i) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={i}
                          src={m.url}
                          alt={`${post.body} ${i + 1}`}
                          className="h-full w-full object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600">
                  <MapPin size={32} className="text-white/80" aria-hidden />
                </div>
              )}

              {/* Place */}
              {placeName && (
                <div className="flex items-center gap-2 px-4 pt-3 text-sm text-text-muted">
                  <MapPin size={14} className="text-primary" aria-hidden />
                  <span className="truncate">{placeName}</span>
                </div>
              )}

              {/* Stats row — reaction summary left, comment/save counts right. */}
              <div className="flex min-h-[32px] items-center justify-between gap-2 px-4 py-3 text-sm text-text-muted">
                <ReactionSummary counts={counts} total={total} onOpenList={() => setListOpen(true)} />
                <span className="ml-auto inline-flex shrink-0 items-center gap-3">
                  <span>
                    {commentCount} {LOCALE === 'vi' ? 'bình luận' : 'comments'}
                  </span>
                  <span>
                    {post.saveCount ?? 0} {LOCALE === 'vi' ? 'lượt lưu' : 'saves'}
                  </span>
                </span>
              </div>

              {/* Action bar — Facebook style */}
              <div className="flex items-center border-t border-border">
                <div className="flex flex-1 items-center justify-center py-1">
                  <ReactionBar
                    viewerReaction={viewerReaction}
                    onSelect={(type) => void changeReaction(type)}
                    onRemove={() => void changeReaction(null)}
                  />
                </div>

                <button
                  type="button"
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-text-muted transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MessageCircle size={18} aria-hidden />
                  {LOCALE === 'vi' ? 'Bình luận' : 'Comment'}
                </button>

                <button
                  type="button"
                  onClick={() => void toggleSave()}
                  aria-pressed={saved}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    saved ? 'text-accent' : 'text-text-muted hover:bg-surface-2',
                  )}
                >
                  <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden />
                  {LOCALE === 'vi' ? 'Lưu' : 'Save'}
                </button>

                <ShareButton
                  postId={id}
                  postBody={post?.body}
                  size="default"
                  onSendMessage={() => setShareOpen(true)}
                />
              </div>
            </Card>

            {/* Who reacted — opened from the summary in the stats row above. */}
            <ReactionListModal
              targetId={id}
              open={listOpen}
              onClose={() => setListOpen(false)}
              initialCounts={counts}
              initialTotal={total}
            />
            <ShareToUserModal
              open={shareOpen}
              onClose={() => setShareOpen(false)}
              postId={id}
              postBody={post?.body}
            />

            {/* Comments */}
            <CommentThread
              postId={id}
              locale={LOCALE}
              onCommentCountChange={setCommentCount}
            />
          </>
        )}
      </div>
    </AppShell>
  );
}