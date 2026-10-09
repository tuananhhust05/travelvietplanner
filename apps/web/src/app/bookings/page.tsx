'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, ChevronRight, Mail, Phone, Users, Wallet } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import {
  STATUS_ACCENT,
  StatusSelect,
  statusMeta,
  type BookingStatus,
} from '@/components/bookings/StatusSelect';
import { formatDate, formatDateRange, formatMoney } from '@/components/bookings/format';
import { cn } from '@/lib/cn';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

interface Booking {
  _id: string;
  fromUserId: string;
  kind?: string;
  refId?: string;
  message?: string;
  travelDates?: { from?: string; to?: string };
  pax?: { adults?: number; children?: number };
  budget?: { amount?: number; currency?: string };
  contact?: { name?: string; phone?: string; email?: string };
  status: BookingStatus;
  createdAt: string;
  updatedAt?: string;
}

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'new', label: 'Mới' },
  { value: 'contacted', label: 'Đã liên hệ' },
  { value: 'quoted', label: 'Đã báo giá' },
  { value: 'won', label: 'Thành công' },
  { value: 'lost', label: 'Thất bại' },
];

export default function BookingsPage() {
  const { isLoggedIn, loading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [filter, setFilter] = useState('all');
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await api.listBookings(filter);
      setBookings((data.items as Booking[]) ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tải đặt chỗ');
    } finally {
      setPageLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn, load]);

  async function handleStatus(b: Booking, status: BookingStatus) {
    setBookings((prev) => prev.map((x) => (x._id === b._id ? { ...x, status } : x)));
    try {
      await api.updateBookingStatus(b._id, status);
    } catch (e) {
      setBookings((prev) => prev.map((x) => (x._id === b._id ? { ...x, status: b.status } : x)));
      setError(e instanceof Error ? e.message : 'Cập nhật thất bại');
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-surface-1 to-surface-1 p-6">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <h1 className="text-2xl font-bold tracking-tight text-text">Đặt chỗ</h1>
            <p className="mt-1 text-sm text-text-muted">
              Quản lý các yêu cầu đặt chỗ từ khách hàng.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === f.value
                  ? 'bg-primary text-primary-fg shadow-e1'
                  : 'border border-border bg-surface-2 text-text-muted hover:bg-surface-3 hover:text-text',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <p className="rounded-xl border border-danger/20 bg-danger/5 px-4 py-2.5 text-sm text-danger">
            {error}
          </p>
        )}

        {loading || pageLoading ? (
          <div className="flex flex-col items-center gap-3 py-20 text-text-muted">
            <div className="relative h-9 w-9">
              <div className="absolute inset-0 rounded-full border-2 border-border" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
            </div>
            <p className="text-sm">Đang tải…</p>
          </div>
        ) : bookings.length === 0 ? (
          <Card className="flex flex-col items-center gap-4 py-20 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2">
              <CalendarCheck size={26} className="text-text-muted/60" />
            </div>
            <div>
              <p className="font-medium text-text">Chưa có yêu cầu đặt chỗ</p>
              <p className="mt-1 text-sm text-text-muted">
                Các yêu cầu từ khách hàng sẽ xuất hiện ở đây.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {bookings.map((b) => {
              const meta = statusMeta(b.status);
              const adults = b.pax?.adults ?? 0;
              const children = b.pax?.children ?? 0;
              const pax = adults + children;
              const dates = formatDateRange(b.travelDates?.from, b.travelDates?.to);
              const name = b.contact?.name ?? 'Khách hàng';

              return (
                <Card
                  key={b._id}
                  className={cn(
                    'relative border-l-[3px] p-5 transition-colors duration-base hover:bg-surface-2',
                    STATUS_ACCENT[b.status] ?? 'border-l-border',
                  )}
                >
                  {/* Overlay link so the whole card navigates while the status
                      picker above it stays independently clickable. */}
                  <Link
                    href={`/bookings/${b._id}`}
                    aria-label={`Xem chi tiết yêu cầu của ${name}`}
                    className="absolute inset-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />

                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold',
                            meta.cls,
                          )}
                        >
                          <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                          {meta.label}
                        </span>
                        <span className="text-xs text-text-muted">{formatDate(b.createdAt)}</span>
                      </div>
                      <h3 className="mt-2 flex items-center gap-1 font-semibold text-text">
                        {name}
                        <ChevronRight size={15} className="text-text-muted" />
                      </h3>
                      {b.message && (
                        <p className="mt-1 line-clamp-2 text-sm text-text-muted">{b.message}</p>
                      )}
                    </div>

                    <div className="relative z-10">
                      <StatusSelect value={b.status} onChange={(s) => handleStatus(b, s)} size="sm" />
                    </div>
                  </div>

                  {(dates || pax > 0 || b.budget?.amount || b.contact?.phone || b.contact?.email) && (
                    <div className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-text-muted sm:grid-cols-2 lg:grid-cols-4">
                      {dates && (
                        <span className="flex items-center gap-1.5">
                          <CalendarCheck size={13} className="shrink-0" />
                          {dates}
                        </span>
                      )}
                      {pax > 0 && (
                        <span className="flex items-center gap-1.5">
                          <Users size={13} className="shrink-0" />
                          {pax} người
                        </span>
                      )}
                      {b.budget?.amount ? (
                        <span className="flex items-center gap-1.5">
                          <Wallet size={13} className="shrink-0" />
                          {formatMoney(b.budget.amount)}
                        </span>
                      ) : null}
                      {b.contact?.phone && (
                        <span className="flex items-center gap-1.5">
                          <Phone size={13} className="shrink-0" />
                          {b.contact.phone}
                        </span>
                      )}
                      {b.contact?.email && (
                        <span className="flex items-center gap-1.5 sm:col-span-2">
                          <Mail size={13} className="shrink-0" />
                          {b.contact.email}
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}
