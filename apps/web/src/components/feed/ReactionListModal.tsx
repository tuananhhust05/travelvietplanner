'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { AlertCircle, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  REACTIONS,
  REACTION_MAP,
  formatCount,
  normalizeCounts,
  normalizeTotal,
  toReactionType,
  type ReactionCounts,
  type ReactionListItem,
  type ReactionType,
} from '@/lib/reactions';

export interface ReactionListModalProps {
  /** Post id or comment id, per `targetType`. */
  targetId: string;
  /** Which endpoint to page through. Defaults to posts. */
  targetType?: 'post' | 'comment';
  open: boolean;
  onClose: () => void;
  /** Lets the tabs render before the first fetch resolves. */
  initialCounts: ReactionCounts;
  initialTotal: number;
  /** Tab to preselect; null/undefined means "Tất cả". */
  initialType?: ReactionType | null;
}

const PAGE_SIZE = 30;
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

type AccountType = 'traveler' | 'agency' | 'business' | 'guide';

function accountType(v: string | undefined): AccountType | undefined {
  return v === 'traveler' || v === 'agency' || v === 'business' || v === 'guide' ? v : undefined;
}

export function ReactionListModal({
  targetId,
  targetType = 'post',
  open,
  onClose,
  initialCounts,
  initialTotal,
  initialType,
}: ReactionListModalProps) {
  const [activeTab, setActiveTab] = useState<ReactionType | null>(initialType ?? null);
  const [counts, setCounts] = useState<ReactionCounts>(() => normalizeCounts(initialCounts));
  const [total, setTotal] = useState(() => normalizeTotal(initialTotal));
  const [items, setItems] = useState<ReactionListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [isGuest, setIsGuest] = useState(true);
  /** Portals need `document`, which does not exist during SSR / hydration. */
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const panelRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  /** Guards against out-of-order responses when the tab changes mid-flight. */
  const reqId = useRef(0);

  // Render-phase reset on closed -> open, so the fetch effect below already
  // sees the right tab and we never fire two requests for one opening.
  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setActiveTab(initialType ?? null);
      setCounts(normalizeCounts(initialCounts));
      setTotal(normalizeTotal(initialTotal));
      setItems([]);
      setNextCursor(null);
      setFollowing({});
      setStatus('loading');
      setError(null);
    }
  }

  const fetchPage = useCallback(
    async (before?: string) => {
      const id = ++reqId.current;
      if (before) setLoadingMore(true);
      else {
        setStatus('loading');
        setError(null);
      }
      try {
        const query = { type: activeTab ?? undefined, limit: PAGE_SIZE, before };
        const data =
          targetType === 'comment'
            ? await api.listCommentReactions(targetId, query)
            : await api.listReactions(targetId, query);
        if (id !== reqId.current) return;
        const page = (data.items ?? []).filter((it) => toReactionType(it.type) !== null);
        setItems((prev) => (before ? [...prev, ...page] : page));
        setNextCursor(data.nextCursor ?? null);
        setCounts(normalizeCounts(data.counts));
        setTotal(normalizeTotal(data.total));
        setFollowing((prev) => {
          const next = { ...prev };
          for (const it of page) {
            if (!(it.user._id in next)) next[it.user._id] = !!it.viewerFollowing;
          }
          return next;
        });
        setStatus('ready');
      } catch (e) {
        if (id !== reqId.current) return;
        if (!before) {
          setError((e as Error).message);
          setStatus('error');
        }
      } finally {
        // Unconditional: a stale response must still clear the spinner, or the
        // sentinel guard below sees loadingMore === true forever and no further
        // page is ever requested. Stale *data* is still dropped by the
        // `id !== reqId.current` checks above.
        setLoadingMore(false);
      }
    },
    [targetId, targetType, activeTab],
  );

  // First page on open, and again whenever the tab changes.
  useEffect(() => {
    if (!open) return;
    setItems([]);
    setNextCursor(null);
    void fetchPage(undefined);
  }, [open, fetchPage]);

  // Infinite scroll — same sentinel pattern as app/feed/page.tsx.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!open || !mounted || !el || !nextCursor) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore) void fetchPage(nextCursor);
      },
      { root: el.parentElement, rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, mounted, nextCursor, loadingMore, fetchPage]);

  // Remember the trigger, lock body scroll, restore both on close.
  // Waits for `mounted` because the panel only exists once the portal renders.
  useEffect(() => {
    if (!open || !mounted) return;
    setIsGuest(!localStorage.getItem('tvp_token'));
    triggerRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    });
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
      triggerRef.current?.focus();
    };
  }, [open, mounted]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const nodes = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
      (n) => n.offsetParent !== null,
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
  }

  async function toggleFollow(userId: string) {
    const was = !!following[userId];
    setFollowing((prev) => ({ ...prev, [userId]: !was }));
    try {
      if (was) await api.unfollow(userId);
      else await api.follow(userId);
    } catch {
      setFollowing((prev) => ({ ...prev, [userId]: was }));
    }
  }

  if (!open || !mounted) return null;

  const tabs = REACTIONS.filter((r) => counts[r.type] > 0 || activeTab === r.type);

  // Portalled to <body> on purpose: the caller (PostCard) applies a rotateX/
  // rotateY tilt to its root element, and a transformed ancestor becomes the
  // containing block for `position: fixed` AND its own stacking context. Left
  // in place, `inset-0` would resolve to the card's box (backdrop covering
  // only the card, panel centred inside it) and `z-[100]` would be trapped
  // below later sibling cards. React still routes events through the React
  // tree, so onKeyDown / onClick below behave exactly as before.
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reaction-list-title"
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          'flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl border border-border',
          'bg-surface-1 shadow-e3 outline-none sm:max-w-md sm:rounded-2xl',
        )}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <h2 id="reaction-list-title" className="text-base font-semibold text-text">
            Cảm xúc {total > 0 && <span className="text-text-muted">({formatCount(total)})</span>}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="rounded-full p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={18} aria-hidden />
          </button>
        </header>

        {/* Tabs — only types with at least one reaction. */}
        <div
          role="tablist"
          aria-label="Lọc theo loại cảm xúc"
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-border px-2"
        >
          <TabButton selected={activeTab === null} onClick={() => setActiveTab(null)}>
            Tất cả <span className="tabular-nums">{formatCount(total)}</span>
          </TabButton>
          {tabs.map((r) => (
            <TabButton
              key={r.type}
              selected={activeTab === r.type}
              onClick={() => setActiveTab(r.type)}
            >
              <span aria-hidden>{r.emoji}</span>
              <span className="sr-only">{r.label}</span>
              <span className="tabular-nums">{formatCount(counts[r.type])}</span>
            </TabButton>
          ))}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {status === 'loading' && (
            <ul className="flex flex-col gap-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <li key={i} className="flex items-center gap-3 px-2 py-2">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                </li>
              ))}
            </ul>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <AlertCircle className="text-danger" size={26} aria-hidden />
              <p className="text-sm text-text-muted">{error ?? 'Không tải được danh sách.'}</p>
              <Button variant="outline" size="sm" onClick={() => void fetchPage(undefined)}>
                Thử lại
              </Button>
            </div>
          )}

          {status === 'ready' && items.length === 0 && (
            <p className="px-4 py-10 text-center text-sm text-text-muted">
              Chưa có ai bày tỏ cảm xúc
            </p>
          )}

          {status === 'ready' && items.length > 0 && (
            <ul className="flex flex-col">
              {items.map((it) => {
                const def = REACTION_MAP[it.type];
                const href = `/profile/${it.user.handle ?? it.user._id}`;
                const isFollowing = !!following[it.user._id];
                return (
                  <li key={it._id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                    <Link
                      href={href}
                      onClick={onClose}
                      className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Avatar
                        name={it.user.displayName}
                        src={it.user.avatarUrl}
                        accountType={accountType(it.user.accountType)}
                        size={40}
                      />
                      <span
                        aria-hidden
                        title={def?.label}
                        className="absolute -bottom-0.5 -right-0.5 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full bg-surface-1 text-[11px] leading-none ring-1 ring-border"
                      >
                        {def?.emoji}
                      </span>
                    </Link>
                    <Link
                      href={href}
                      onClick={onClose}
                      className="min-w-0 flex-1 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <p className="truncate text-sm font-semibold text-text hover:underline">
                        {it.user.displayName}
                      </p>
                      {it.user.handle && (
                        <p className="truncate text-xs text-text-muted">@{it.user.handle}</p>
                      )}
                      <span className="sr-only">{def?.label}</span>
                    </Link>
                    {!it.isSelf && !isGuest && (
                      <Button
                        size="sm"
                        variant={isFollowing ? 'outline' : 'primary'}
                        aria-pressed={isFollowing}
                        onClick={() => void toggleFollow(it.user._id)}
                      >
                        {isFollowing ? 'Đang theo dõi' : 'Theo dõi'}
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div ref={sentinelRef} className="h-1" aria-hidden />
          {loadingMore && (
            <div className="flex justify-center py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary" />
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function TabButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected
          ? 'border-primary text-primary'
          : 'border-transparent text-text-muted hover:text-text',
      )}
    >
      {children}
    </button>
  );
}
