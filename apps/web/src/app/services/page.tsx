'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Briefcase, MapPin, Clock, Users, Pencil, Trash2, Eye, Pause, Play, X, User as UserIcon } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface Service {
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
  createdAt: string;
}

interface Viewer {
  userId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  viewedAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

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

function formatPrice(price?: number, currency?: string): string {
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

export default function ServicesPage() {
  const { user, isLoggedIn, loading } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Viewers modal state
  const [viewersService, setViewersService] = useState<Service | null>(null);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api.listServices();
      setServices((data.items as Service[]) ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải dịch vụ');
    } finally {
      setPageLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn, load]);

  async function openViewers(s: Service) {
    setViewersService(s);
    setViewers([]);
    setViewersLoading(true);
    try {
      const data = await api.getServiceViewers(s._id);
      setViewers(data.viewers);
    } catch {
      // silently ignore — viewers list is optional
    } finally {
      setViewersLoading(false);
    }
  }

  function closeViewers() {
    setViewersService(null);
    setViewers([]);
  }

  async function handleToggleStatus(s: Service) {
    const next = s.status === 'active' ? 'paused' : 'active';
    try {
      await api.updateService(s._id, { status: next });
      setServices((prev) => prev.map((x) => (x._id === s._id ? { ...x, status: next } : x)));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Cập nhật thất bại');
    }
  }

  async function handleDelete(s: Service) {
    if (!confirm(`Xóa dịch vụ "${s.title}"?`)) return;
    try {
      await api.deleteService(s._id);
      setServices((prev) => prev.filter((x) => x._id !== s._id));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Xóa thất bại');
    }
  }

  const activeCount = services.filter((s) => s.status === 'active').length;

  return (
    <AppShell>
      <div className="space-y-5">

        {/* ── Ambient header ── */}
        <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-surface-1 to-surface-2 p-6">
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-secondary/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-8 left-8 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-secondary animate-pulse" />
                <span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">Quản lý</span>
              </div>
              <h1 className="text-2xl font-bold text-text">Dịch vụ của tôi</h1>
              <p className="mt-1 text-sm text-text-muted">Quản lý các tour và dịch vụ hướng dẫn của bạn.</p>
            </div>
            <Link
              href="/services/new"
              className="flex shrink-0 items-center gap-2 rounded-xl bg-secondary px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-secondary/25 transition-all duration-200 hover:brightness-110 hover:shadow-secondary/40"
            >
              <Plus size={15} /> Thêm dịch vụ
            </Link>
          </div>

          {!pageLoading && !loading && services.length > 0 && (
            <div className="relative mt-5 flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface-2/70 px-3 py-1.5 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                <span className="text-xs text-text">
                  <span className="font-bold text-emerald-400">{activeCount}</span> đang hoạt động
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-surface-2/70 px-3 py-1.5 backdrop-blur-sm">
                <Briefcase size={12} className="text-text-muted" />
                <span className="text-xs text-text">
                  <span className="font-bold">{services.length}</span> tổng dịch vụ
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
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-secondary" />
            </div>
            <p className="text-sm">Đang tải dịch vụ…</p>
          </div>

        ) : error ? (
          <div className="rounded-2xl border border-danger/20 bg-danger/5 p-6 text-center">
            <p className="text-sm text-danger">{error}</p>
          </div>

        ) : services.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-surface-1 py-20 text-center">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-secondary/5 to-transparent" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/10 blur-3xl" />
            <div className="relative flex flex-col items-center gap-4">
              <div className="rounded-2xl border border-border/50 bg-surface-2/80 p-5">
                <Briefcase size={34} className="text-text-muted/50" />
              </div>
              <div>
                <p className="font-semibold text-text">Chưa có dịch vụ nào</p>
                <p className="mt-1 text-sm text-text-muted">Tạo dịch vụ đầu tiên để bắt đầu nhận khách.</p>
              </div>
              <Link
                href="/services/new"
                className="flex items-center gap-2 rounded-xl bg-secondary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-secondary/25 transition-all hover:brightness-110"
              >
                <Plus size={15} /> Tạo dịch vụ đầu tiên
              </Link>
            </div>
          </div>

        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s, i) => (
              <div
                key={s._id}
                className="group relative overflow-hidden rounded-2xl border border-border/50 bg-surface-1 transition-all duration-300 hover:-translate-y-0.5 hover:border-border hover:shadow-xl hover:shadow-black/25"
                style={{ animation: 'svcFadeUp 0.4s ease both', animationDelay: `${i * 55}ms` }}
              >
                {/* Cover image */}
                <div className="relative h-40 overflow-hidden bg-surface-2">
                  {s.coverImage || s.images?.[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={s.coverImage || s.images![0]}
                      alt={s.title}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-2 to-surface-1">
                      <Briefcase size={28} className="text-text-muted/35" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                  {/* Status badge */}
                  <span
                    className={`absolute left-3 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md ${
                      s.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        s.status === 'active'
                          ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.9)]'
                          : 'bg-amber-400'
                      }`}
                    />
                    {s.status === 'active' ? 'Đang hoạt động' : 'Tạm dừng'}
                  </span>

                  {/* Price chip on image */}
                  <div className="absolute bottom-3 right-3">
                    <span className="rounded-xl bg-black/55 px-2.5 py-1 text-sm font-bold text-white backdrop-blur-sm">
                      {formatPrice(s.price, s.currency)}
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_COLORS[s.category ?? 'other'] ?? CATEGORY_COLORS.other}`}>
                      {CATEGORY_LABELS[s.category ?? 'tour'] ?? s.category}
                    </span>
                    <span className="text-[11px] text-text-muted">{formatDate(s.createdAt)}</span>
                  </div>

                  <h3 className="font-semibold leading-snug text-text">{s.title}</h3>
                  {s.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">{s.description}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                    {s.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={11} className="text-text-muted/60" /> {s.location}
                      </span>
                    )}
                    {s.duration && (
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-text-muted/60" /> {s.duration}
                      </span>
                    )}
                    {s.maxPax && (
                      <span className="flex items-center gap-1">
                        <Users size={11} className="text-text-muted/60" /> {s.maxPax} người
                      </span>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
                    {s.counters ? (
                      <button
                        onClick={() => openViewers(s)}
                        className="flex items-center gap-1 text-xs text-text-muted transition-colors hover:text-text"
                        title="Xem danh sách người đã xem"
                      >
                        <Eye size={11} /> {s.counters.views} lượt xem
                      </button>
                    ) : (
                      <span />
                    )}

                    <div className="flex items-center gap-0.5">
                      <button
                        onClick={() => handleToggleStatus(s)}
                        title={s.status === 'active' ? 'Tạm dừng' : 'Kích hoạt'}
                        className={`rounded-lg p-2 transition-colors ${
                          s.status === 'active'
                            ? 'text-text-muted hover:bg-amber-500/10 hover:text-amber-400'
                            : 'text-text-muted hover:bg-emerald-500/10 hover:text-emerald-400'
                        }`}
                      >
                        {s.status === 'active' ? <Pause size={15} /> : <Play size={15} />}
                      </button>
                      <Link
                        href={`/services/${s._id}/edit`}
                        title="Chỉnh sửa"
                        className="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
                      >
                        <Pencil size={15} />
                      </Link>
                      <button
                        onClick={() => handleDelete(s)}
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
        @keyframes svcFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Viewers modal */}
      {viewersService && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
          onClick={closeViewers}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md rounded-2xl border border-border/50 bg-surface-1 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
              <div>
                <h2 className="font-semibold text-text">Người đã xem</h2>
                <p className="mt-0.5 line-clamp-1 text-xs text-text-muted">{viewersService.title}</p>
              </div>
              <button
                onClick={closeViewers}
                className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="max-h-80 overflow-y-auto px-3 py-3">
              {viewersLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-secondary" />
                </div>
              ) : viewers.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <Eye size={28} className="text-text-muted/40" />
                  <p className="text-sm text-text-muted">Chưa có ai xem dịch vụ này</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {viewers.map((v) => (
                    <li key={v.userId} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
                      {v.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.avatarUrl} alt={v.displayName} className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-text-muted">
                          <UserIcon size={14} />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-text">{v.displayName}</p>
                        {v.handle && <p className="truncate text-xs text-text-muted">@{v.handle}</p>}
                      </div>
                      <span className="shrink-0 text-xs text-text-muted">{timeAgo(v.viewedAt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Footer count */}
            {!viewersLoading && viewers.length > 0 && (
              <div className="border-t border-border/50 px-5 py-3 text-xs text-text-muted">
                {viewers.length} người xem duy nhất
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}
