'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Calendar,
  Globe,
  Lock,
  MapPin,
  MessageCircle,
  Plane,
  Wallet,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { DayCard, type ItineraryDay } from '@/components/planner/DayCard';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CommentThread } from '@/components/post/CommentThread';
import { useLocale } from '@/lib/i18n';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getSocket, subscribeSocketChange } from '@/lib/socket';
import { cn } from '@/lib/cn';
import type { Socket } from 'socket.io-client';

interface TripDay {
  day: number;
  title: string;
  stops: { name: string; note?: string }[];
  budget?: string;
}

interface TripAuthor {
  _id: string;
  displayName?: string;
  handle?: string;
  avatarUrl?: string;
  accountType?: string;
}

interface Trip {
  id: string;
  userId: string;
  title: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  days: TripDay[];
  visibility: 'private' | 'public';
  commentCount: number;
  createdAt: string;
  author?: TripAuthor | null;
}

function formatDate(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function timeAgo(iso?: string): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const mins = Math.floor(Math.max(0, Date.now() - then) / 60000);
  if (mins < 1) return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(then).toLocaleDateString('vi-VN');
}

function profileHref(author?: TripAuthor | null): string {
  const handle = author?.handle?.replace(/^@/, '');
  if (handle && handle !== 'traveler') return `/profile/${handle}`;
  if (author?._id) return `/profile/${author._id}`;
  return '#';
}

type AccountType = 'traveler' | 'agency' | 'business' | 'guide';
function toAccountType(v: string | undefined): AccountType | undefined {
  return v === 'traveler' || v === 'agency' || v === 'business' || v === 'guide' ? v : undefined;
}

const HERO_GRADIENTS = [
  'from-emerald-400 via-teal-500 to-cyan-600',
  'from-amber-400 via-orange-500 to-rose-600',
  'from-violet-400 via-purple-500 to-indigo-600',
  'from-pink-400 via-rose-500 to-red-600',
  'from-sky-400 via-blue-500 to-indigo-600',
];

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [status, setStatus] = useState<'loading' | 'notfound' | 'error' | 'ready'>('loading');
  const [commentCount, setCommentCount] = useState(0);
  const [visibilityLoading, setVisibilityLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    const token = localStorage.getItem('tvp_token');
    void fetch(`${api.base}/v1/trips/${id}`, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem('tvp_token');
          localStorage.removeItem('tvp_refresh');
          localStorage.removeItem('tvp_user');
          window.location.href = '/login';
          return;
        }
        if (res.status === 404) { setStatus('notfound'); return; }
        if (!res.ok) { setStatus('error'); return; }
        const data = (await res.json()) as Trip;
        setTrip(data);
        setCommentCount(data.commentCount ?? 0);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let socket: Socket | null = null;
    const join = (s: Socket | null) => {
      socket = s;
      if (s) s.emit('trip:subscribe', [id]);
    };
    join(getSocket());
    const unsub = subscribeSocketChange(join);
    return () => {
      unsub();
      if (socket) socket.emit('trip:unsubscribe', [id]);
    };
  }, [id]);

  const isOwner = user && trip && user.id === trip.userId;

  async function toggleVisibility() {
    if (!trip || !isOwner) return;
    const next = trip.visibility === 'public' ? 'private' : 'public';
    setVisibilityLoading(true);
    try {
      await api.updateTripVisibility(trip.id, next);
      setTrip((t) => t ? { ...t, visibility: next } : t);
    } catch {
      // ignore
    } finally {
      setVisibilityLoading(false);
    }
  }

  const days: ItineraryDay[] = (trip?.days ?? []).map((d) => ({
    day: d.day,
    title: d.title,
    stops: d.stops,
    budget: d.budget ?? '',
  }));

  const canComment = trip?.visibility === 'public' || isOwner;
  const authorName = trip?.author?.displayName ?? 'Người dùng';
  const heroGradient = HERO_GRADIENTS[(trip?.id?.charCodeAt(0) ?? 0) % HERO_GRADIENTS.length];

  return (
    <AppShell>
      <div className="mx-auto max-w-xl space-y-4 px-4 py-6 sm:px-0">
        {/* Back */}
        <Link
          href="/planner"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={16} aria-hidden />
          Về trang Planner
        </Link>

        {/* ── Loading skeleton ── */}
        {status === 'loading' && (
          <Card className="p-0 overflow-hidden" aria-busy aria-label="Đang tải chuyến đi">
            <div className="flex animate-pulse items-center gap-3 p-4">
              <div className="h-11 w-11 rounded-full bg-surface-3" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-40 rounded bg-surface-3" />
                <div className="h-3 w-24 rounded bg-surface-3" />
              </div>
            </div>
            <div className="aspect-[16/7] w-full animate-pulse bg-surface-3" />
            <div className="space-y-3 p-4">
              <div className="h-5 w-2/3 rounded bg-surface-3" />
              <div className="h-3 w-1/3 rounded bg-surface-3" />
            </div>
          </Card>
        )}

        {/* ── Not found ── */}
        {status === 'notfound' && (
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <p className="text-lg font-semibold text-text">Không tìm thấy chuyến đi</p>
            <p className="text-sm text-text-muted">Chuyến đi này không tồn tại hoặc đã bị xóa.</p>
            <Link href="/planner"><Button variant="outline">Về trang Planner</Button></Link>
          </Card>
        )}

        {/* ── Error ── */}
        {status === 'error' && (
          <Card className="flex flex-col items-center gap-4 p-10 text-center">
            <p className="text-lg font-semibold text-text">Đã có lỗi xảy ra</p>
            <p className="text-sm text-text-muted">Không thể tải chuyến đi. Vui lòng thử lại.</p>
            <Button variant="outline" onClick={() => window.location.reload()}>Thử lại</Button>
          </Card>
        )}

        {/* ── Ready ── */}
        {status === 'ready' && trip && (
          <>
            {/* ═══ Main card (Facebook-style post card) ═══
                No overflow-hidden: ReactionBar picker is absolute bottom-full */}
            <Card className="p-0">

              {/* Author header */}
              <header className="flex items-center gap-3 p-4">
                <Link
                  href={profileHref(trip.author)}
                  className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Avatar
                    name={authorName}
                    src={trip.author?.avatarUrl}
                    accountType={toAccountType(trip.author?.accountType)}
                    size={44}
                  />
                </Link>

                <div className="min-w-0 flex-1">
                  <Link
                    href={profileHref(trip.author)}
                    className="block truncate text-[15px] font-semibold text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {authorName}
                  </Link>
                  <p className="flex items-center gap-1.5 text-xs text-text-muted">
                    <span>{timeAgo(trip.createdAt)}</span>
                    <span aria-hidden>·</span>
                    {trip.visibility === 'public'
                      ? <Globe size={11} aria-label="Công khai" />
                      : <Lock size={11} aria-label="Riêng tư" />
                    }
                  </p>
                </div>

                {/* Visibility toggle — owner only */}
                {isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={visibilityLoading}
                    onClick={toggleVisibility}
                    className="shrink-0 gap-1.5 text-xs"
                    aria-label={trip.visibility === 'public' ? 'Chuyển sang riêng tư' : 'Chuyển sang công khai'}
                  >
                    {trip.visibility === 'public'
                      ? <><Globe size={13} className="text-primary" aria-hidden />Công khai</>
                      : <><Lock size={13} className="text-text-muted" aria-hidden />Riêng tư</>
                    }
                  </Button>
                )}
              </header>

              {/* Trip title */}
              <div className="px-4 pb-3">
                <h1 className="text-balance text-[17px] font-semibold leading-snug text-text">
                  {trip.title}
                </h1>
              </div>

              {/* Hero cover — gradient with destination overlay */}
              <div className={cn(
                'relative flex aspect-[16/7] w-full items-center justify-center overflow-hidden bg-gradient-to-br',
                heroGradient,
              )}>
                <div className="absolute inset-0 bg-black/25" />
                <div className="relative z-10 flex flex-col items-center gap-2 px-4 text-center text-white">
                  <Plane size={38} className="opacity-75 drop-shadow-lg" aria-hidden />
                  {trip.destination && (
                    <p className="text-xl font-bold drop-shadow-lg">{trip.destination}</p>
                  )}
                  {(trip.startDate || trip.endDate) && (
                    <p className="text-sm font-medium opacity-90 drop-shadow">
                      {formatDate(trip.startDate)}
                      {trip.startDate && trip.endDate ? ' – ' : ''}
                      {formatDate(trip.endDate)}
                    </p>
                  )}
                </div>
              </div>

              {/* Meta pills */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-3 text-sm text-text-muted">
                {trip.destination && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin size={14} className="shrink-0 text-primary" aria-hidden />
                    {trip.destination}
                  </span>
                )}
                {(trip.startDate || trip.endDate) && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={14} className="shrink-0" aria-hidden />
                    {formatDate(trip.startDate)}
                    {trip.startDate && trip.endDate ? ' – ' : ''}
                    {formatDate(trip.endDate)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Wallet size={14} className="shrink-0" aria-hidden />
                  {days.length} ngày
                </span>
              </div>

              {/* Stats row */}
              {canComment && (
                <div className="flex items-center justify-end px-4 py-2 text-xs text-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <MessageCircle size={13} aria-hidden />
                    {commentCount} bình luận
                  </span>
                </div>
              )}

              {/* Action bar */}
              {canComment && (
                <div className="flex items-center border-t border-border">
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-semibold text-text-muted transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      document.getElementById('comment-section')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                  >
                    <MessageCircle size={18} aria-hidden />
                    Bình luận
                  </button>
                </div>
              )}
            </Card>

            {/* ═══ Itinerary card ═══ */}
            {days.length > 0 ? (
              <Card className="p-4">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-text">
                  <Plane size={15} className="text-primary" aria-hidden />
                  Lịch trình {days.length} ngày
                </h2>
                <ol
                  className="relative space-y-4 border-l border-border pl-0"
                  aria-label="Lịch trình"
                >
                  {days.map((day, i) => (
                    <DayCard key={day.day} day={day} index={i} locale={locale} />
                  ))}
                </ol>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <p className="text-sm text-text-muted">Chuyến đi này chưa có lịch trình.</p>
              </Card>
            )}

            {/* ═══ Comments ═══ */}
            {canComment && (
              <Card className="p-4" id="comment-section">
                <CommentThread
                  postId={trip.id}
                  targetType="trip"
                  locale={locale}
                  onCommentCountChange={setCommentCount}
                />
              </Card>
            )}

            {/* Prompt owner to make trip public if private */}
            {isOwner && trip.visibility === 'private' && (
              <Card className="flex items-center gap-3 p-4">
                <Lock size={16} className="shrink-0 text-text-muted" aria-hidden />
                <p className="flex-1 text-sm text-text-muted">
                  Chuyến đi đang ở chế độ riêng tư. Chuyển sang{' '}
                  <button
                    className="font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={toggleVisibility}
                    disabled={visibilityLoading}
                  >
                    công khai
                  </button>{' '}
                  để cho phép bình luận.
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
