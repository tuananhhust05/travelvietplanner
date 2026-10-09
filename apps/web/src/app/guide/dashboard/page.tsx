'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import {
  CalendarCheck,
  Star,
  MessageCircle,
  Briefcase,
  DollarSign,
  Clock,
  TrendingUp,
  ArrowUpRight,
  Plus,
  ChevronRight,
  Users,
  Zap,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { useAuth } from '@/lib/auth';

const STATS = [
  {
    label: 'Tour tuần này',
    value: '0',
    icon: CalendarCheck,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
  },
  {
    label: 'Đánh giá',
    value: '—',
    icon: Star,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
  },
  {
    label: 'Thu nhập tháng',
    value: '0đ',
    icon: DollarSign,
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/20',
  },
  {
    label: 'Tin nhắn mới',
    value: '0',
    icon: MessageCircle,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/20',
  },
];

const QUICK_ACTIONS = [
  {
    href: '/bookings',
    icon: CalendarCheck,
    label: 'Lịch đặt',
    desc: 'Xem & quản lý booking',
    gradient: 'from-emerald-500/15 to-teal-500/5',
    iconColor: 'text-emerald-400',
    iconBg: 'bg-emerald-400/10',
  },
  {
    href: '/services',
    icon: Briefcase,
    label: 'Dịch vụ',
    desc: 'Quản lý tour & dịch vụ',
    gradient: 'from-sky-500/15 to-indigo-500/5',
    iconColor: 'text-sky-400',
    iconBg: 'bg-sky-400/10',
  },
  {
    href: '/messages',
    icon: MessageCircle,
    label: 'Tin nhắn',
    desc: 'Chat với khách hàng',
    gradient: 'from-violet-500/15 to-purple-500/5',
    iconColor: 'text-violet-400',
    iconBg: 'bg-violet-400/10',
  },
];

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  bg,
  border,
  index,
}: (typeof STATS)[number] & { index: number }) {
  return (
    <div
      className="stat-card relative overflow-hidden rounded-2xl border bg-surface-1 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      style={{ borderColor: `hsl(var(--border))` }}
    >
      {/* glow blob */}
      <div className={`pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full blur-2xl ${bg} opacity-60`} />
      <div className="relative">
        <span className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${bg} ${color}`}>
          <Icon size={17} />
        </span>
        <p className="text-2xl font-bold tracking-tight text-text">{value}</p>
        <p className="mt-0.5 text-xs text-text-muted">{label}</p>
      </div>
    </div>
  );
}

export default function GuideDashboard() {
  const { user } = useAuth();
  const profile = user?.profiles.find((p) => p.type === 'guide');
  const displayName = profile?.displayName ?? 'Hướng dẫn viên';
  const staggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cards = staggerRef.current?.querySelectorAll<HTMLElement>('.stat-card');
    if (!cards) return;
    cards.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(12px) scale(0.97)';
      el.style.transition = `opacity 0.35s ease ${i * 0.06}s, transform 0.35s ease ${i * 0.06}s`;
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0) scale(1)';
        }),
      );
    });
  }, []);

  return (
    <AppShell>
      <div className="space-y-5 pb-8">
        {/* ── Hero header ─────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-surface-1 p-6">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-transparent to-sky-500/5" />
          <div className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-emerald-400/8 blur-3xl" />

          <div className="relative flex items-start justify-between gap-4">
            <div>
              <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 ring-1 ring-emerald-400/20">
                <Zap size={10} />
                Hướng dẫn viên
              </span>
              <h1 className="text-2xl font-bold text-text">
                Xin chào, {displayName} 👋
              </h1>
              <p className="mt-1 text-sm text-text-muted">
                Quản lý lịch tour và dịch vụ của bạn ngay tại đây.
              </p>
            </div>

            <Link
              href="/services/new"
              className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all duration-200 hover:bg-emerald-400 hover:shadow-emerald-400/30 active:scale-95"
            >
              <Plus size={15} />
              Thêm dịch vụ
            </Link>
          </div>
        </div>

        {/* ── Stats ───────────────────────────────────────────── */}
        <div ref={staggerRef} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STATS.map((stat, i) => (
            <StatCard key={stat.label} {...stat} index={i} />
          ))}
        </div>

        {/* ── Upcoming bookings ───────────────────────────────── */}
        <div className="overflow-hidden rounded-2xl border border-border bg-surface-1">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-400/10">
                <CalendarCheck size={14} className="text-emerald-400" />
              </span>
              <h2 className="text-sm font-semibold text-text">Lịch đặt sắp tới</h2>
            </div>
            <Link
              href="/bookings"
              className="flex items-center gap-0.5 text-xs font-medium text-primary transition-colors hover:text-emerald-400"
            >
              Xem tất cả
              <ChevronRight size={13} />
            </Link>
          </div>

          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
                <Clock size={28} className="text-text-muted opacity-40" />
              </div>
              <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-400/20 ring-2 ring-surface-1">
                <TrendingUp size={10} className="text-amber-400" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-text">Chưa có lịch đặt nào</p>
              <p className="mt-0.5 text-xs text-text-muted">
                Thêm dịch vụ để khách hàng có thể đặt tour với bạn
              </p>
            </div>
            <Link
              href="/services"
              className="flex items-center gap-1.5 rounded-xl bg-surface-2 px-4 py-2 text-sm font-medium text-text transition-colors hover:bg-surface-3"
            >
              <Briefcase size={14} />
              Quản lý dịch vụ
            </Link>
          </div>
        </div>

        {/* ── Quick actions ───────────────────────────────────── */}
        <div>
          <p className="mb-3 px-0.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Truy cập nhanh
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {QUICK_ACTIONS.map(({ href, icon: Icon, label, desc, gradient, iconColor, iconBg }) => (
              <Link
                key={href}
                href={href}
                className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${gradient} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md`}
              >
                <div className="flex items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg} ${iconColor} transition-transform duration-200 group-hover:scale-110`}>
                    <Icon size={19} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">{label}</p>
                    <p className="truncate text-xs text-text-muted">{desc}</p>
                  </div>
                  <ArrowUpRight
                    size={15}
                    className="ml-auto shrink-0 text-text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
                  />
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Profile completeness ────────────────────────────── */}
        <div className="flex items-center gap-4 rounded-2xl border border-border bg-surface-1 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/10">
            <Users size={18} className="text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-text">Hoàn thiện hồ sơ của bạn</p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500 transition-all duration-700"
                style={{ width: `${profile?.profileCompleteness ?? 30}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-text-muted">
              {profile?.profileCompleteness ?? 30}% hoàn thành
            </p>
          </div>
          <Link
            href="/profile/me"
            className="shrink-0 rounded-xl bg-surface-2 px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-3"
          >
            Cập nhật
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
