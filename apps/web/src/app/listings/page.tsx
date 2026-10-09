'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Building2, MapPin, Pencil, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface Listing {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  price?: number;
  currency?: string;
  location?: string;
  images?: string[];
  status: 'active' | 'paused';
  createdAt: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  hotel:      'Khách sạn',
  restaurant: 'Nhà hàng',
  attraction: 'Điểm tham quan',
  cafe:       'Cà phê',
  resort:     'Resort',
  spa:        'Spa',
  shopping:   'Mua sắm',
  transport:  'Vận chuyển',
  other:      'Khác',
};

const CATEGORY_COLORS: Record<string, string> = {
  hotel:      'bg-blue-500/15 text-blue-400 ring-1 ring-blue-500/20',
  restaurant: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20',
  attraction: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20',
  cafe:       'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/20',
  resort:     'bg-purple-500/15 text-purple-400 ring-1 ring-purple-500/20',
  spa:        'bg-pink-500/15 text-pink-400 ring-1 ring-pink-500/20',
  shopping:   'bg-indigo-500/15 text-indigo-400 ring-1 ring-indigo-500/20',
  transport:  'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/20',
  other:      'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/20',
};

function formatPrice(price?: number): string {
  if (!price) return 'Liên hệ';
  return new Intl.NumberFormat('vi-VN').format(price) + 'đ';
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function ListingsPage() {
  const { isLoggedIn, loading } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await (api as unknown as { listListings: () => Promise<{ items: Listing[] }> }).listListings();
      setListings(data.items ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải listing');
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn, load]);

  async function handleDelete(l: Listing) {
    if (!confirm(`Xóa listing "${l.title}"?`)) return;
    try {
      await (api as unknown as { deleteListing: (id: string) => Promise<unknown> }).deleteListing(l._id);
      setListings((prev) => prev.filter((x) => x._id !== l._id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }

  const activeCount = listings.filter((l) => l.status === 'active').length;

  return (
    <AppShell>
      <div className="space-y-5">

        {/* ── Ambient header ── */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-surface-1 to-surface-2 p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 left-8 h-36 w-36 rounded-full bg-secondary/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Quản lý</span>
              </div>
              <h1 className="text-2xl font-bold text-text">Listing của tôi</h1>
              <p className="mt-1 text-sm text-text-muted">Quản lý các địa điểm và dịch vụ du lịch của bạn.</p>
            </div>
            <Link
              href="/listings/new"
              className="flex shrink-0 items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all duration-200 hover:brightness-110 hover:shadow-primary/40"
            >
              <Plus size={15} /> Thêm listing
            </Link>
          </div>

          {!pageLoading && !loading && listings.length > 0 && (
            <div className="relative mt-5 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface-2/70 px-3 py-1.5 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                <span className="text-xs text-text">
                  <span className="font-bold text-emerald-400">{activeCount}</span> đang hoạt động
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface-2/70 px-3 py-1.5 backdrop-blur-sm">
                <Building2 size={12} className="text-text-muted" />
                <span className="text-xs text-text">
                  <span className="font-bold">{listings.length}</span> tổng listing
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ── States ── */}
        {loading || pageLoading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-text-muted">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-2 border-border" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-primary" />
            </div>
            <p className="text-sm">Đang tải listing…</p>
          </div>

        ) : error ? (
          <div className="rounded-2xl border border-danger/20 bg-danger/5 p-6 text-center">
            <p className="text-sm text-danger">{error}</p>
          </div>

        ) : listings.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-surface-1 py-20 text-center">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
            <div className="relative flex flex-col items-center gap-4">
              <div className="rounded-2xl border border-border/50 bg-surface-2/80 p-5">
                <Building2 size={34} className="text-text-muted/50" />
              </div>
              <div>
                <p className="font-semibold text-text">Chưa có listing nào</p>
                <p className="mt-1 text-sm text-text-muted">Hãy thêm listing đầu tiên!</p>
              </div>
              <Link
                href="/listings/new"
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:brightness-110"
              >
                <Plus size={15} /> Thêm listing đầu tiên
              </Link>
            </div>
          </div>

        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l, i) => (
              <div
                key={l._id}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-surface-1 transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-xl hover:shadow-black/25"
                style={{ animation: 'lstFadeUp 0.4s ease both', animationDelay: `${i * 55}ms` }}
              >
                {/* Cover image */}
                <div className="relative h-40 overflow-hidden bg-surface-2">
                  {l.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={l.images[0]}
                      alt={l.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-2 to-surface-1">
                      <Building2 size={28} className="text-text-muted/35" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                  {/* Status badge */}
                  <span
                    className={`absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md ${
                      l.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        l.status === 'active'
                          ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.9)]'
                          : 'bg-amber-400'
                      }`}
                    />
                    {l.status === 'active' ? 'Đang hoạt động' : 'Tạm dừng'}
                  </span>

                  {/* Price chip */}
                  <div className="absolute bottom-3 right-3">
                    <span className="rounded-xl bg-black/55 px-2.5 py-1 text-sm font-bold text-white backdrop-blur-sm">
                      {formatPrice(l.price)}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[l.category ?? 'other'] ?? CATEGORY_COLORS.other}`}>
                      {CATEGORY_LABELS[l.category ?? 'other'] ?? l.category}
                    </span>
                    <span className="text-[11px] text-text-muted">{formatDate(l.createdAt)}</span>
                  </div>

                  <h3 className="font-semibold leading-snug text-text">{l.title}</h3>
                  {l.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">{l.description}</p>
                  )}

                  {l.location && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-text-muted">
                      <MapPin size={11} className="text-text-muted/60" /> {l.location}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="mt-3 flex items-center justify-end border-t border-border/50 pt-3">
                    <div className="flex items-center gap-0.5">
                      <Link
                        href={`/listings/${l._id}/edit`}
                        title="Chỉnh sửa"
                        className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                      >
                        <Pencil size={15} />
                      </Link>
                      <button
                        onClick={() => handleDelete(l)}
                        title="Xóa"
                        className="rounded-lg p-2 text-text-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes lstFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </AppShell>
  );
}
