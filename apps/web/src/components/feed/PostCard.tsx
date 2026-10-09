'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from 'framer-motion';
import { MessageCircle, Bookmark, MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { t, type Locale } from '@/lib/i18n';
import { placeLabel } from '@/lib/place';
import { ReactionBar } from '@/components/feed/ReactionBar';
import { ReactionSummary } from '@/components/feed/ReactionSummary';
import { ReactionListModal } from '@/components/feed/ReactionListModal';
import { EMPTY_REACTION_COUNTS, type ReactionCounts, type ReactionType } from '@/lib/reactions';
import { ShareButton } from '@/components/post/ShareButton';
import { ShareToUserModal } from '@/components/post/ShareToUserModal';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

export type AccountType = 'traveler' | 'agency' | 'business' | 'guide';

export interface FeedPost {
  _id: string;
  body: string;
  lang?: string;
  createdAt?: string;
  author: {
    _id?: string;
    name: string;
    handle: string;
    accountType: AccountType;
    avatarUrl?: string;
  };
  /** Tailwind gradient classes for the cover placeholder. */
  cover: string;
  media: { url: string; type: 'image' | 'video' }[];
  place: { name: string; lat?: number; lng?: number } | null;
  address: { commune: string; province: string; label: string } | null;
  tags: string[];
  /** Legacy alias for `reactionsTotal`, still sent by the API. */
  likeCount: number;
  commentCount: number;
  saveCount: number;
  viewerLiked?: boolean;
  viewerSaved?: boolean;
  /** Absolute per-type reaction counts. */
  reactions: ReactionCounts;
  reactionsTotal: number;
  /** The viewer's own reaction — never overwritten by realtime broadcasts. */
  viewerReaction: ReactionType | null;
  /** Auto-created feed post for a tour → deep-link to the service detail page. */
  serviceId?: string;
  /** Auto-created feed post for a listing → deep-link to the listing detail page. */
  listingId?: string;
}

interface PostCardProps {
  post: FeedPost;
  locale?: Locale;
  /** Select or switch reaction type. Owned by the page holding the posts array. */
  onReact?: (id: string, type: ReactionType) => void;
  /** Remove the viewer's reaction. */
  onUnreact?: (id: string) => void;
  onToggleSave?: (id: string, saved: boolean) => void;
}

/** Formats an ISO date into a short relative label (vi/en aware). */
function timeAgo(iso: string | undefined, locale: Locale): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.max(1, Math.round((Date.now() - then) / 60000));
  if (mins < 60) return locale === 'vi' ? `${mins} phút` : `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return locale === 'vi' ? `${hrs} giờ` : `${hrs}h`;
  const days = Math.round(hrs / 24);
  return locale === 'vi' ? `${days} ngày` : `${days}d`;
}

/** Resolve a profile link from the author's handle (or _id fallback). */
function profileHref(author: FeedPost['author']): string {
  const handle = author.handle?.replace(/^@/, '');
  if (handle && handle !== 'traveler') return `/profile/${handle}`;
  if (author._id) return `/profile/${author._id}`;
  return '#';
}

/** Auto-created tour/listing posts deep-link to their detail page; everything
 *  else opens the post itself. */
function postHref(post: FeedPost): string {
  if (post.serviceId) return `/services/${post.serviceId}`;
  if (post.listingId) return `/listings/${post.listingId}`;
  return `/post/${post._id}`;
}

export function PostCard({ post, locale = 'vi', onReact, onUnreact, onToggleSave }: PostCardProps) {
  const reduce = useReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);

  // 3D tilt driven by pointer position, capped at 8°.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useSpring(useTransform(my, [-0.5, 0.5], [8, -8]), {
    stiffness: 220,
    damping: 20,
  });
  const rotateY = useSpring(useTransform(mx, [-0.5, 0.5], [-8, 8]), {
    stiffness: 220,
    damping: 20,
  });

  // Save state is optimistic and local. Both the stats row and the footer button
  // read `saveCount` — reading the prop in one and the state in the other made
  // the two numbers on screen disagree by one after a save.
  const [saved, setSaved] = useState(post.viewerSaved ?? false);
  const [saveCount, setSaveCount] = useState(post.saveCount);
  const [expanded, setExpanded] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const label = placeLabel(post.place, post.address);

  const { isLoggedIn } = useAuth();

  // Track service view when a logged-in user sees a feed post linked to a tour
  useEffect(() => {
    if (!isLoggedIn || !post.serviceId) return;
    api.trackServiceView(post.serviceId).catch(() => {});
  }, [isLoggedIn, post.serviceId]);

  // Reaction state is owned by the page holding the posts array, so read it from props.
  const counts = post.reactions ?? EMPTY_REACTION_COUNTS;
  const total = post.reactionsTotal ?? 0;
  const viewerReaction = post.viewerReaction ?? null;

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduce || !cardRef.current) return;
    // Freeze the tilt while the reaction picker is open: rotating the card as the
    // pointer travels toward an emoji moves the target out from under the cursor.
    // ReactionBar owns its own open state, so read it off the DOM — the picker
    // element only exists while open.
    if (cardRef.current.querySelector('[role="menu"]')) return;
    const rect = cardRef.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    mx.set(px - 0.5);
    my.set(py - 0.5);
    cardRef.current.style.setProperty('--x', `${px * 100}%`);
    cardRef.current.style.setProperty('--y', `${py * 100}%`);
  }

  function handlePointerLeave() {
    mx.set(0);
    my.set(0);
  }

  function toggleSave() {
    const next = !saved;
    setSaved(next);
    setSaveCount((c) => c + (next ? 1 : -1));
    onToggleSave?.(post._id, next);
  }

  const href = postHref(post);
  // Tour/listing posts deep-link to their detail page — no comment thread there.
  const isTourPost = !!(post.serviceId || post.listingId);

  return (
    <motion.article
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0, 0, 0.2, 1] }}
      className={cn(
        'spotlight group relative rounded-2xl border border-border bg-surface-1 shadow-e2',
        'transition-shadow duration-base hover:shadow-e3',
      )}
    >
      {/* Cover — clicking navigates to detail. `overflow-hidden` lives here, not on
          the card: the reaction picker is positioned `absolute bottom-full` and would
          be clipped by the card. */}
      <Link
        href={href}
        aria-label={
          locale === 'vi'
            ? `Xem bài viết tại ${label || 'Việt Nam'}`
            : `View post at ${label || 'Vietnam'}`
        }
        className="block overflow-hidden rounded-t-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className={cn('relative aspect-[16/10] w-full', post.media.length === 0 && post.cover)}>
          {post.media.length > 0 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.media[0].url}
              alt={post.body}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
          )}
          {label && (
            <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
              <MapPin size={13} aria-hidden />
              {label}
            </span>
          )}
        </div>
      </Link>

      {/* Clicking anywhere on the content body (author + caption + tags) navigates
          to detail. Action buttons below are excluded via stopPropagation. */}
      <Link href={href} className="block p-4 pb-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring">
        {/* Author row */}
        <header className="flex items-center gap-3">
          {/* Author link stops propagation so it goes to the profile, not the post */}
          <span
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            className="contents"
          >
            <Link
              href={profileHref(post.author)}
              className="flex min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Avatar
                name={post.author.name}
                src={post.author.avatarUrl}
                accountType={post.author.accountType}
                size={40}
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text hover:underline">
                  {post.author.name}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {post.author.handle} · {timeAgo(post.createdAt, locale)}
                </p>
              </div>
            </Link>
          </span>
        </header>

        {/* Caption */}
        <p
          className={cn(
            'mt-3 text-pretty text-sm leading-relaxed text-text',
            !expanded && 'line-clamp-4',
          )}
        >
          {post.body}
        </p>
        {!expanded && post.body.length > 160 && (
          <span
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); setExpanded(true); } }}
            role="button"
            tabIndex={0}
            className="mt-1 cursor-pointer text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t(locale, 'common.viewMore')}
          </span>
        )}

        {/* Tagged places */}
        {post.tags.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <li key={tag}>
                <Badge tone="primary">
                  <MapPin size={11} aria-hidden />
                  {tag}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        {/* Stats row */}
        <div className="mt-3 flex min-h-[24px] items-center justify-between gap-2 border-b border-border pb-2 text-xs text-text-muted">
          <ReactionSummary counts={counts} total={total} onOpenList={() => setListOpen(true)} />
          <span className="ml-auto inline-flex shrink-0 items-center gap-2">
            <span>
              {post.commentCount} {locale === 'vi' ? 'bình luận' : 'comments'}
            </span>
            <span>
              {saveCount} {locale === 'vi' ? 'lượt lưu' : 'saves'}
            </span>
          </span>
        </div>
      </Link>

      {/* Footer actions — elevated zone, clicks do NOT navigate */}
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="px-4 pb-3 pt-1"
      >
        <footer className="flex items-center gap-1 rounded-xl bg-surface-2/60 px-2 py-1 shadow-e1">
          <ReactionBar
            viewerReaction={viewerReaction}
            onSelect={(type) => onReact?.(post._id, type)}
            onRemove={() => onUnreact?.(post._id)}
            size="sm"
          />

          {isTourPost ? (
            <button
              type="button"
              aria-label={t(locale, 'feed.comment')}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageCircle size={18} aria-hidden />
              {post.commentCount}
            </button>
          ) : (
            <Link
              href={href}
              aria-label={t(locale, 'feed.comment')}
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <MessageCircle size={18} aria-hidden />
              {post.commentCount}
            </Link>
          )}

          <motion.button
            type="button"
            onClick={toggleSave}
            aria-pressed={saved}
            aria-label={t(locale, 'feed.save')}
            whileTap={reduce ? undefined : { scale: 0.9 }}
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              saved ? 'text-accent' : 'text-text-muted hover:text-text',
            )}
          >
            <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} aria-hidden />
            {saveCount}
          </motion.button>

          <ShareButton
            size="sm"
            postId={post._id}
            postBody={post.body}
            onSendMessage={() => setShareOpen(true)}
          />
        </footer>
      </div>

      <ReactionListModal
        targetId={post._id}
        open={listOpen}
        onClose={() => setListOpen(false)}
        initialCounts={counts}
        initialTotal={total}
      />
      <ShareToUserModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        postId={post._id}
        postBody={post.body}
      />
    </motion.article>
  );
}
