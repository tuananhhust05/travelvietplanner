'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, MapPin, Clock, Compass, User, X } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';

interface TourGuide {
  _id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
}

interface Tour {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  price?: number;
  currency?: string;
  duration?: string;
  location?: string;
  maxPax?: number;
  coverImage?: string;
  images?: string[];
  video?: string;
  status: 'active' | 'paused';
  counters?: { views: number; inquiries: number };
  guide?: TourGuide;
}

const CATEGORIES = ['tour', 'hiking', 'city', 'food', 'culture', 'adventure', 'other'] as const;

const CATEGORY_LABELS: Record<string, string> = {
  tour: 'Tour',
  hiking: 'Leo núi',
  city: 'Tham quan thành phố',
  food: 'Ẩm thực',
  culture: 'Văn hóa',
  adventure: 'Phiêu lưu',
  other: 'Khác',
};

const CATEGORY_COLORS: Record<string, string> = {
  tour:      'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/20',
  hiking:    'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20',
  city:      'bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/20',
  food:      'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20',
  culture:   'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/20',
  adventure: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20',
  other:     'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/20',
};

function formatPrice(price?: number): string {
  if (!price) return 'Liên hệ';
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

export default function ToursPage() {
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const load = useCallback(async (params: { q?: string; category?: string } = {}) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.exploreServices({
        ...(params.q ? { q: params.q } : {}),
        ...(params.category ? { category: params.category } : {}),
        limit: 50,
      });
      setTours((data.items as Tour[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải tour');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch all active tours on mount.
  useEffect(() => {
    load();
  }, [load]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load({ q: query.trim() || undefined, category: activeCategory ?? undefined });
  }

  function handleCategory(category: string | null) {
    setActiveCategory(category);
    load({ q: query.trim() || undefined, category: category ?? undefined });
  }

  const chipBase = 'rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-200';
  const chipInactive = 'border border-border bg-surface-1 text-text-muted hover:border-border hover:bg-surface-2 hover:text-text';

  return (
    <AppShell>
      <div className="space-y-6">
        {/* ── Hero / header ── */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-surface-1 to-surface-2 p-6 md:p-8">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-secondary/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 left-8 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative">
            <div className="mb-1 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Khám phá</span>
            </div>
            <h1 className="text-2xl font-bold text-text md:text-3xl">Tìm tour cùng hướng dẫn viên</h1>
            <p className="mt-1 max-w-xl text-sm text-text-muted">
              Khám phá các tour và trải nghiệm do hướng dẫn viên địa phương tổ chức trên khắp Việt Nam.
            </p>

            {/* Search box */}
            <form onSubmit={handleSearch} className="mt-5 flex max-w-xl items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm kiếm tour, điểm đến…"
                  className="w-full rounded-xl border border-border bg-surface-2 py-2.5 pl-9 pr-9 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => { setQuery(''); load({ category: activeCategory ?? undefined }); }}
                    aria-label="Xóa tìm kiếm"
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-text-muted hover:bg-surface-3 hover:text-text"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-secondary/25 transition-all duration-200 hover:brightness-110 hover:shadow-secondary/40"
              >
                <Search size={15} /> Tìm
              </button>
            </form>
          </div>
        </div>

        {/* ── Category filter chips ── */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCategory(null)}
            className={cn(chipBase, activeCategory === null ? 'bg-secondary text-white shadow-lg shadow-secondary/25' : chipInactive)}
          >
            Tất cả
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategory(activeCategory === cat ? null : cat)}
              className={cn(chipBase, activeCategory === cat ? CATEGORY_COLORS[cat] : chipInactive)}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* ── States ── */}
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-text-muted">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-2 border-border" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-secondary" />
            </div>
            <p className="text-sm">Đang tải tour…</p>
          </div>

        ) : error ? (
          <div className="rounded-2xl border border-danger/20 bg-danger/5 p-6 text-center">
            <p className="text-sm text-danger">{error}</p>
          </div>

        ) : tours.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-surface-1 py-20 text-center">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-secondary/5 to-transparent" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/10 blur-3xl" />
            <div className="relative flex flex-col items-center gap-4">
              <div className="rounded-2xl border border-border/50 bg-surface-2/80 p-5">
                <Compass size={34} className="text-text-muted/50" />
              </div>
              <div>
                <p className="font-semibold text-text">Không tìm thấy tour nào</p>
                <p className="mt-1 text-sm text-text-muted">Thử thay đổi từ khóa hoặc chọn danh mục khác để khám phá thêm.</p>
              </div>
              <button
                onClick={() => { setQuery(''); setActiveCategory(null); load(); }}
                className="flex items-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-secondary/25 transition-all hover:brightness-110"
              >
                <X size={15} /> Xóa bộ lọc
              </button>
            </div>
          </div>

        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tours.map((tour, i) => (
              <Link
                key={tour._id}
                href={`/services/${tour._id}`}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-surface-1 transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-xl hover:shadow-black/25"
                style={{ animation: 'tourFadeUp 0.4s ease both', animationDelay: `${i * 55}ms` }}
              >
                {/* Cover image */}
                <div className="relative h-44 overflow-hidden bg-surface-2">
                  {tour.coverImage || tour.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={tour.coverImage || tour.images![0]} alt={tour.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-2 to-surface-1">
                      <Compass size={30} className="text-text-muted/35" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                  {/* Category badge */}
                  <span className={cn('absolute left-3 top-3 rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md', CATEGORY_COLORS[tour.category ?? 'other'] ?? CATEGORY_COLORS.other)}>
                    {CATEGORY_LABELS[tour.category ?? 'tour'] ?? tour.category}
                  </span>

                  {/* Price chip on image */}
                  <div className="absolute bottom-3 right-3">
                    <span className="rounded-xl bg-black/55 px-2.5 py-1 text-sm font-bold text-white backdrop-blur-sm">{formatPrice(tour.price)}</span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4">
                  <h3 className="font-semibold leading-snug text-text group-hover:text-primary transition-colors">
                    {tour.title}
                  </h3>
                  {tour.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">{tour.description}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                    {tour.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} className="text-text-muted/60" /> {tour.location}
                      </span>
                    )}
                    {tour.duration && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-text-muted/60" /> {tour.duration}
                      </span>
                    )}
                  </div>

                  {/* Guide footer */}
                  <div className="mt-3 flex items-center gap-2 border-t border-border/50 pt-3">
                    {tour.guide?.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={tour.guide.avatarUrl} alt={tour.guide.displayName} className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-2">
                        <User size={12} className="text-text-muted" />
                      </span>
                    )}
                    <span className="text-xs text-text-muted">
                      {tour.guide?.displayName ? (
                        <>
                          Hướng dẫn bởi <span className="font-medium text-text">{tour.guide.displayName}</span>
                        </>
                      ) : (
                        'Hướng dẫn viên địa phương'
                      )}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes tourFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </AppShell>
  );
}