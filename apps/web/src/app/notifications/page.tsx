'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  Heart,
  MessageCircle,
  Reply,
  UserPlus,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useNotifications } from '@/hooks/useNotifications';
import type { NotificationActor, NotificationType, NotificationView } from '@/lib/api';

/**
 * "Đề cập" is deliberately absent: the API has no @mention parsing, so a mentions
 * tab could only ever render an empty list. The previous version of this page was
 * entirely mock data and offered one.
 */
type Filter = 'Tất cả' | 'Chưa đọc';
const FILTERS: Filter[] = ['Tất cả', 'Chưa đọc'];

type AccountType = 'traveler' | 'agency' | 'business' | 'guide';

function accountType(v: string | undefined): AccountType | undefined {
  return v === 'traveler' || v === 'agency' || v === 'business' || v === 'guide' ? v : undefined;
}

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  post_reaction: { icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  comment_reaction: { icon: Heart, color: 'text-rose-500', bg: 'bg-rose-500/10' },
  post_comment: { icon: MessageCircle, color: 'text-sky-500', bg: 'bg-sky-500/10' },
  comment_reply: { icon: Reply, color: 'text-sky-500', bg: 'bg-sky-500/10' },
  follow: { icon: UserPlus, color: 'text-primary', bg: 'bg-primary/10' },
};

/** What each type did, in Vietnamese. The actor clause is prepended separately. */
const TYPE_TEXT: Record<NotificationType, string> = {
  post_reaction: 'đã bày tỏ cảm xúc về bài viết của bạn',
  comment_reaction: 'đã bày tỏ cảm xúc về bình luận của bạn',
  post_comment: 'đã bình luận bài viết của bạn',
  comment_reply: 'đã phản hồi bình luận của bạn',
  follow: 'đã bắt đầu theo dõi bạn',
};

/**
 * Facebook-style actor clause. `actorCount` is authoritative, NOT `actors.length`:
 * the server caps the stored actor list for display, so a row with 40 reactions
 * carries only a handful of actors.
 */
function actorText(actors: NotificationActor[], actorCount: number): string {
  const lead = actors[0]?.displayName ?? 'Người dùng';
  const others = Math.max(0, actorCount - 1);
  if (others <= 0) return lead;
  if (others === 1 && actors[1]) return `${lead} và ${actors[1].displayName}`;
  return `${lead} và ${others} người khác`;
}

/** Same handle-without-`@`, `_id`-fallback rule the comment tree uses. */
function profileHref(actor: NotificationActor | undefined): string {
  const handle = actor?.handle?.replace(/^@/, '');
  if (handle && handle !== 'traveler') return `/profile/${handle}`;
  if (actor?._id) return `/profile/${actor._id}`;
  return '#';
}

/** Where the row goes. A follow has no post, so it opens the follower's profile. */
function targetHref(n: NotificationView): string {
  if (n.type === 'follow') return profileHref(n.actors[0]);
  if (n.postId) return `/post/${n.postId}`;
  return profileHref(n.actors[0]);
}

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.floor(Math.max(0, Date.now() - then) / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày`;
  return new Date(then).toLocaleDateString('vi-VN');
}

type TimeGroup = 'Hôm nay' | 'Hôm qua' | 'Cũ hơn';
const GROUPS: TimeGroup[] = ['Hôm nay', 'Hôm qua', 'Cũ hơn'];

/**
 * Calendar-day buckets, not elapsed-hours buckets: something posted at 23:50 is
 * "Hôm qua" at 00:10, which is what a reader expects. The mock version stored the
 * group as a literal string on each row, so it could never age.
 */
function timeGroup(iso: string): TimeGroup {
  const then = new Date(iso);
  if (!Number.isFinite(then.getTime())) return 'Cũ hơn';
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (then.getTime() >= startOfToday.getTime()) return 'Hôm nay';
  return then.getTime() >= startOfToday.getTime() - 86_400_000 ? 'Hôm qua' : 'Cũ hơn';
}

export default function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>('Tất cả');
  const {
    items,
    unreadCount,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    markRead,
    markAllRead,
    retry,
  } = useNotifications(filter === 'Chưa đọc');

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text">Thông báo</h1>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm text-text-muted transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          >
            <CheckCheck size={15} aria-hidden />
            Đánh dấu tất cả đã đọc
          </button>
        </div>

        <div className="mt-4 flex gap-1 rounded-xl border border-border bg-surface-1 p-1">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`relative flex flex-1 items-center justify-center rounded-lg py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                filter === f ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
              }`}
            >
              {f}
              {f === 'Chưa đọc' && unreadCount > 0 && (
                <span
                  className={`ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs ${
                    filter === f ? 'bg-white/25 text-white' : 'bg-primary/15 text-primary'
                  }`}
                >
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* A failed mark-read surfaces the same `error`, so this sits above the list
            rather than replacing it. Retry only appears when nothing loaded, i.e.
            when the failure was the first fetch. */}
        {error && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden />
            <p className="min-w-0 flex-1">{error}</p>
            {items.length === 0 && (
              <Button size="sm" variant="outline" onClick={retry}>
                Thử lại
              </Button>
            )}
          </div>
        )}

        {loading ? (
          <div className="mt-6 space-y-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-border p-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {GROUPS.map((group) => {
              const rows = items.filter((n) => timeGroup(n.updatedAt) === group);
              if (rows.length === 0) return null;
              return (
                <section key={group} aria-label={group}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    {group}
                  </p>
                  <ul className="space-y-1">
                    {rows.map((n) => {
                      const { icon: Icon, color, bg } = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.follow;
                      const unread = !n.readAt;
                      const lead = n.actors[0];
                      return (
                        <motion.li
                          key={n._id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.18 }}
                        >
                          <Link
                            href={targetHref(n)}
                            onClick={() => markRead(n._id)}
                            className={`relative flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                              unread
                                ? 'border-primary/20 bg-primary/5'
                                : 'border-border bg-surface-1 hover:bg-surface-3'
                            }`}
                          >
                            <div className="relative shrink-0">
                              <Avatar
                                name={lead?.displayName ?? 'Người dùng'}
                                src={lead?.avatarUrl ?? undefined}
                                accountType={accountType(lead?.accountType)}
                                size={40}
                              />
                              <span
                                className={`absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full ${bg}`}
                              >
                                <Icon size={10} className={color} aria-hidden />
                              </span>
                            </div>

                            <div className="min-w-0 flex-1 pr-5">
                              <p className="text-sm leading-snug text-text">
                                <span className="font-semibold">
                                  {actorText(n.actors, n.actorCount)}
                                </span>{' '}
                                {TYPE_TEXT[n.type] ?? ''}
                              </p>
                              <p className="mt-0.5 text-xs text-text-muted">
                                <time dateTime={n.updatedAt}>{timeAgo(n.updatedAt)}</time>
                              </p>
                            </div>

                            {unread && (
                              <span
                                aria-hidden
                                className="absolute right-4 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-primary"
                              />
                            )}
                          </Link>
                        </motion.li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            {items.length === 0 && !error && (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface-1 py-14 text-center">
                <Bell size={32} className="text-text-muted" strokeWidth={1.5} aria-hidden />
                <p className="text-sm text-text-muted">
                  {filter === 'Chưa đọc'
                    ? 'Bạn đã đọc tất cả thông báo'
                    : 'Không có thông báo nào'}
                </p>
              </div>
            )}

            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                loading={loadingMore}
                onClick={loadMore}
              >
                Xem thêm
              </Button>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}
