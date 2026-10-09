'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  CalendarCheck, ChevronLeft, Clock, Hash, Mail, MapPin, MessageSquare,
  Phone, Tag, Users, Wallet,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { StatusSelect, statusMeta, type BookingStatus } from '@/components/bookings/StatusSelect';
import { formatDateRange, formatDateTime, formatMoney } from '@/components/bookings/format';
import { cn } from '@/lib/cn';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface BookingDetail {
  _id: string;
  kind?: string;
  message?: string;
  travelDates?: { from?: string; to?: string } | null;
  pax?: { adults?: number; children?: number };
  budget?: { amount?: number; currency?: string };
  contact?: { name?: string; phone?: string; email?: string };
  status: BookingStatus;
  source?: string;
  createdAt: string;
  updatedAt?: string;
  viewerRole: 'guide' | 'traveler';
  service?: {
    _id: string;
    title?: string;
    coverImage?: string;
    price?: number;
    duration?: string;
    location?: string;
    category?: string;
  } | null;
  counterparty?: {
    _id: string;
    displayName?: string;
    handle?: string;
    avatarUrl?: string | null;
    accountType?: string;
  } | null;
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3 text-sm">
      <span className="shrink-0 text-text-muted">{icon}</span>
      <span className="text-text-muted">{label}</span>
      <span className="ml-auto text-right font-medium text-text">{value}</span>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoggedIn, loading: authLoading } = useAuth();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getBooking(id);
      setBooking(data as BookingDetail);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể tải yêu cầu';
      if (msg.includes('404') || msg.toLowerCase().includes('not found')) setNotFound(true);
      else setError(msg);
    } finally {
      setPageLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isLoggedIn) load();
  }, [isLoggedIn, load]);

  async function handleStatus(status: BookingStatus) {
    if (!booking) return;
    setSaving(true);
    const previous = booking.status;
    setBooking({ ...booking, status });
    try {
      await api.updateBookingStatus(booking._id, status);
    } catch (e) {
      setBooking({ ...booking, status: previous });
      setError(e instanceof Error ? e.message : 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  }

  const meta = booking ? statusMeta(booking.status) : null;
  const dates = formatDateRange(booking?.travelDates?.from, booking?.travelDates?.to);
  const adults = booking?.pax?.adults ?? 0;
  const children = booking?.pax?.children ?? 0;
  const paxLabel = [adults ? `${adults} người lớn` : '', children ? `${children} trẻ em` : '']
    .filter(Boolean)
    .join(', ');

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/bookings"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text"
        >
          <ChevronLeft size={16} /> Tất cả yêu cầu
        </Link>

        {authLoading || pageLoading ? (
          <div className="flex flex-col items-center gap-3 py-24 text-text-muted">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-2 border-border" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
            </div>
            <p className="text-sm">Đang tải yêu cầu…</p>
          </div>
        ) : notFound ? (
          <Card className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
              <CalendarCheck size={30} className="text-text-muted/50" />
            </div>
            <h2 className="text-lg font-semibold text-text">Không tìm thấy yêu cầu</h2>
            <p className="mt-1 text-sm text-text-muted">
              Yêu cầu này có thể đã bị xóa hoặc bạn không có quyền xem.
            </p>
            <Link href="/bookings" className="mt-5 inline-block">
              <Button variant="outline">Quay lại danh sách</Button>
            </Link>
          </Card>
        ) : booking && meta ? (
          <>
            {/* Identity + status */}
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar
                    name={booking.counterparty?.displayName ?? booking.contact?.name ?? 'Khách'}
                    src={booking.counterparty?.avatarUrl ?? undefined}
                    size={52}
                  />
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-bold leading-tight text-text">
                      {booking.contact?.name ?? booking.counterparty?.displayName ?? 'Khách hàng'}
                    </h1>
                    {booking.counterparty?.handle && (
                      <Link
                        href={`/profile/${booking.counterparty.handle}`}
                        className="text-sm text-text-muted transition-colors hover:text-primary"
                      >
                        @{booking.counterparty.handle}
                      </Link>
                    )}
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
                      <Clock size={11} /> {formatDateTime(booking.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  {booking.viewerRole === 'guide' ? (
                    <>
                      <StatusSelect
                        value={booking.status}
                        onChange={handleStatus}
                        disabled={saving}
                        size="md"
                      />
                      {saving && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                      )}
                    </>
                  ) : (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
                        meta.cls,
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
                      {meta.label}
                    </span>
                  )}
                </div>
              </div>

              {error && (
                <p className="mt-4 rounded-xl border border-danger/20 bg-danger/5 px-4 py-2.5 text-sm text-danger">
                  {error}
                </p>
              )}
            </Card>

            {/* Tour being asked about */}
            {booking.service && (
              <Card className="overflow-hidden">
                <Link href={`/services/${booking.service._id}`} className="flex items-center gap-4 p-4 transition-colors hover:bg-surface-2">
                  <div className="h-16 w-24 shrink-0 overflow-hidden rounded-xl bg-surface-2">
                    {booking.service.coverImage && (
                      <img
                        src={booking.service.coverImage}
                        alt={booking.service.title ?? ''}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                      Tour được hỏi
                    </p>
                    <p className="mt-0.5 truncate font-semibold text-text">{booking.service.title}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
                      {booking.service.location && (
                        <span className="flex items-center gap-1">
                          <MapPin size={11} /> {booking.service.location}
                        </span>
                      )}
                      {booking.service.duration && (
                        <span className="flex items-center gap-1">
                          <Clock size={11} /> {booking.service.duration}
                        </span>
                      )}
                      {typeof booking.service.price === 'number' && (
                        <span className="flex items-center gap-1">
                          <Tag size={11} /> {formatMoney(booking.service.price)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </Card>
            )}

            {/* Contact */}
            <Card className="p-5 sm:p-6">
              <h2 className="mb-3 text-base font-semibold text-text">Thông tin liên hệ</h2>
              <div className="space-y-2">
                {booking.contact?.phone && (
                  <a
                    href={`tel:${booking.contact.phone}`}
                    className="flex items-center gap-2.5 rounded-xl border border-border px-4 py-2.5 text-sm text-text transition-colors hover:border-primary/40 hover:bg-surface-2"
                  >
                    <Phone size={14} className="shrink-0 text-text-muted" />
                    {booking.contact.phone}
                  </a>
                )}
                {booking.contact?.email && (
                  <a
                    href={`mailto:${booking.contact.email}`}
                    className="flex items-center gap-2.5 rounded-xl border border-border px-4 py-2.5 text-sm text-text transition-colors hover:border-primary/40 hover:bg-surface-2"
                  >
                    <Mail size={14} className="shrink-0 text-text-muted" />
                    {booking.contact.email}
                  </a>
                )}
                {!booking.contact?.phone && !booking.contact?.email && (
                  <p className="text-sm italic text-text-muted">Khách không để lại thông tin liên hệ.</p>
                )}
              </div>
            </Card>

            {/* Trip details */}
            {(dates || paxLabel || booking.budget?.amount) && (
              <Card className="p-5 sm:p-6">
                <h2 className="mb-3 text-base font-semibold text-text">Chi tiết chuyến đi</h2>
                <div className="divide-y divide-border rounded-xl border border-border">
                  {dates && <Row icon={<CalendarCheck size={14} />} label="Ngày đi" value={dates} />}
                  {paxLabel && <Row icon={<Users size={14} />} label="Số người" value={paxLabel} />}
                  {booking.budget?.amount ? (
                    <Row icon={<Wallet size={14} />} label="Ngân sách" value={formatMoney(booking.budget.amount)} />
                  ) : null}
                </div>
              </Card>
            )}

            {/* Message */}
            {booking.message && (
              <Card className="p-5 sm:p-6">
                <h2 className="mb-3 text-base font-semibold text-text">Tin nhắn từ khách</h2>
                <div className="flex gap-3 rounded-xl border border-border bg-surface-2/50 px-4 py-3">
                  <MessageSquare size={14} className="mt-1 shrink-0 text-text-muted" />
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-text">
                    {booking.message}
                  </p>
                </div>
              </Card>
            )}

            {/* Meta */}
            <Card className="p-5 sm:p-6">
              <h2 className="mb-3 text-base font-semibold text-text">Thông tin yêu cầu</h2>
              <div className="space-y-1.5 text-xs text-text-muted">
                <p className="flex items-center gap-1.5">
                  <Hash size={11} className="shrink-0" />
                  <span className="font-mono">{booking._id}</span>
                </p>
                <p>Nhận lúc: {formatDateTime(booking.createdAt)}</p>
                {booking.updatedAt && booking.updatedAt !== booking.createdAt && (
                  <p>Cập nhật: {formatDateTime(booking.updatedAt)}</p>
                )}
              </div>
            </Card>
          </>
        ) : error ? (
          <Card className="border-danger/20 bg-danger/5 p-6 text-center">
            <p className="text-sm text-danger">{error}</p>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
