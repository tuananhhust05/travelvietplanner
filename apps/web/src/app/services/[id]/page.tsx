'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { MapPin, Clock, Users, CalendarDays, CheckCircle2, User as UserIcon, Compass, ChevronLeft, Play, Pencil } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { api, BookingItem } from '@/lib/api';

interface PublicService {
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
  status?: string;
  counters?: { views: number; inquiries: number };
  guide?: { _id: string; displayName: string; handle: string; avatarUrl?: string | null };
}

const CATEGORY_LABELS: Record<string, string> = {
  tour: 'Tour', hiking: 'Leo núi', city: 'Tham quan thành phố', food: 'Ẩm thực',
  culture: 'Văn hóa', adventure: 'Phiêu lưu', other: 'Khác',
};

const CATEGORY_COLORS: Record<string, string> = {
  tour: 'bg-cyan-500/15 text-cyan-400 ring-1 ring-cyan-500/20',
  hiking: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20',
  city: 'bg-violet-500/15 text-violet-400 ring-1 ring-violet-500/20',
  food: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20',
  culture: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/20',
  adventure: 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/20',
  other: 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/20',
};

const formatPrice = (price?: number) => (price ? new Intl.NumberFormat('vi-VN').format(price) + 'đ' : 'Liên hệ');

const field = 'mb-1.5 block text-sm font-medium text-text';

export default function ServiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isLoggedIn, loading: authLoading } = useAuth();

  const [service, setService] = useState<PublicService | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  const [travelDate, setTravelDate] = useState('');
  const [pax, setPax] = useState(1);
  const [note, setNote] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

  const [existingBooking, setExistingBooking] = useState<BookingItem | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editDate, setEditDate] = useState('');
  const [editPax, setEditPax] = useState(1);
  const [editNote, setEditNote] = useState('');
  const [editContactName, setEditContactName] = useState('');
  const [editContactPhone, setEditContactPhone] = useState('');
  const [editContactEmail, setEditContactEmail] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.getPublicService(id);
      setService(data as PublicService);
      setActiveImage((data as PublicService).coverImage || (data as PublicService).images?.[0] || null);
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Không thể tải tour';
      if (msg.includes('404') || msg.includes('not found')) setNotFound(true);
      else setError(msg);
    } finally {
      setPageLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Track view for logged-in users (fire-and-forget, skip owner)
  useEffect(() => {
    if (!id || !isLoggedIn || authLoading) return;
    api.trackServiceView(id).catch(() => {});
  }, [id, isLoggedIn, authLoading]);

  const isTraveler = isLoggedIn && user?.activeProfileType === 'traveler';

  useEffect(() => {
    if (!id || !isLoggedIn || !isTraveler) return;
    setBookingLoading(true);
    api.getMyBookings(id)
      .then((res) => {
        if (res.items && res.items.length > 0) setExistingBooking(res.items[0]);
      })
      .catch(() => {})
      .finally(() => setBookingLoading(false));
  }, [id, isLoggedIn, isTraveler]);
  const gallery = service?.images?.length ? service.images : service?.coverImage ? [service.coverImage] : [];
  const heroImage = activeImage || service?.coverImage || gallery[0] || null;

  const STATUS_LABELS: Record<string, string> = {
    new: 'Chờ xác nhận',
    contacted: 'Đã liên hệ',
    quoted: 'Đã báo giá',
    won: 'Đã xác nhận',
    lost: 'Đã hủy',
    spam: 'Spam',
  };

  function openEdit() {
    if (!existingBooking) return;
    const from = existingBooking.travelDates?.from;
    setEditDate(from ? new Date(from).toISOString().split('T')[0] : '');
    setEditPax(existingBooking.pax?.adults ?? 1);
    setEditNote(existingBooking.message ?? '');
    setEditContactName(existingBooking.contact?.name ?? '');
    setEditContactPhone(existingBooking.contact?.phone ?? '');
    setEditContactEmail(existingBooking.contact?.email ?? '');
    setEditError(null);
    setEditing(true);
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!existingBooking) return;
    setEditSubmitting(true);
    setEditError(null);
    try {
      const updated = await api.updateBooking(existingBooking._id, {
        travelDate: editDate || undefined,
        pax: editPax,
        note: editNote || undefined,
        contact: {
          name: editContactName || undefined,
          phone: editContactPhone || undefined,
          email: editContactEmail || undefined,
        },
      });
      setExistingBooking(updated as BookingItem);
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Cập nhật thất bại, vui lòng thử lại');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    if (!service) return;
    if (!travelDate) { setBookingError('Vui lòng chọn ngày đi'); return; }
    setSubmitting(true);
    setBookingError(null);
    try {
      await api.createBooking({
        serviceId: service._id,
        travelDate,
        pax,
        note: note || undefined,
        contact: { name: contactName || undefined, phone: contactPhone || undefined, email: contactEmail || undefined },
      });
      setBooked(true);
      // Reload booking để lần sau vào trang hiện đúng trạng thái
      api.getMyBookings(service._id).then((res) => {
        if (res.items?.length) setExistingBooking(res.items[0]);
      }).catch(() => {});
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : 'Đặt tour thất bại, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/tours" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text">
          <ChevronLeft size={16} /> Tất cả tour
        </Link>

        {pageLoading || authLoading ? (
          <div className="flex flex-col items-center gap-3 py-24 text-text-muted">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-2 border-border" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-secondary" />
            </div>
            <p className="text-sm">Đang tải tour…</p>
          </div>
        ) : notFound ? (
          <Card className="p-10 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-2">
              <Compass size={30} className="text-text-muted/50" />
            </div>
            <h2 className="text-lg font-semibold text-text">Không tìm thấy tour</h2>
            <p className="mt-1 text-sm text-text-muted">Tour này có thể đã bị xóa hoặc không tồn tại.</p>
            <Link href="/tours" className="mt-5 inline-block">
              <Button variant="outline">Quay lại danh sách tour</Button>
            </Link>
          </Card>
        ) : error ? (
          <Card className="border-danger/20 bg-danger/5 p-6 text-center">
            <p className="text-sm text-danger">{error}</p>
          </Card>
        ) : service ? (
          <>
            {/* Hero + gallery */}
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface-1">
              <div className="relative h-72 w-full overflow-hidden bg-surface-2 sm:h-96">
                {heroImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={heroImage} alt={service.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-surface-2 to-surface-1">
                    <Compass size={44} className="text-text-muted/35" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold backdrop-blur-md ${CATEGORY_COLORS[service.category ?? 'other'] ?? CATEGORY_COLORS.other}`}>
                  {CATEGORY_LABELS[service.category ?? 'tour'] ?? service.category}
                </span>
                <div className="absolute bottom-4 right-4">
                  <span className="rounded-xl bg-black/55 px-3 py-1.5 text-lg font-bold text-white backdrop-blur-sm">
                    {formatPrice(service.price)}
                  </span>
                </div>
              </div>
              {gallery.length > 1 && (
                <div className="flex gap-2 overflow-x-auto p-3">
                  {gallery.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImage(img)}
                      className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${activeImage === img ? 'border-secondary' : 'border-transparent opacity-70 hover:opacity-100'}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img} alt={`${service.title} ${i + 1}`} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title + meta */}
            <div>
              <h1 className="text-2xl font-bold leading-snug text-text sm:text-3xl">{service.title}</h1>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-muted">
                {service.location && (
                  <span className="flex items-center gap-1.5"><MapPin size={15} className="text-text-muted/60" /> {service.location}</span>
                )}
                {service.duration && (
                  <span className="flex items-center gap-1.5"><Clock size={15} className="text-text-muted/60" /> {service.duration}</span>
                )}
                {service.maxPax && (
                  <span className="flex items-center gap-1.5"><Users size={15} className="text-text-muted/60" /> Tối đa {service.maxPax} người</span>
                )}
              </div>
            </div>

            {/* Video */}
            {service.video && (
              <Card className="overflow-hidden p-0">
                <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3">
                  <Play size={15} className="text-secondary" />
                  <span className="text-sm font-semibold text-text">Video giới thiệu</span>
                </div>
                <div className="aspect-video w-full bg-black">
                  <video src={service.video} controls className="h-full w-full" />
                </div>
              </Card>
            )}

            {/* Description */}
            <Card className="p-5 sm:p-6">
              <h2 className="mb-3 text-lg font-semibold text-text">Giới thiệu tour</h2>
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-text-muted">
                {service.description || 'Chưa có mô tả chi tiết cho tour này.'}
              </p>
            </Card>

            {/* Guide card */}
            {service.guide && (
              <Card className="flex items-center gap-4 p-5">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2">
                  {service.guide.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={service.guide.avatarUrl} alt={service.guide.displayName} className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon size={24} className="text-text-muted/50" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-widest text-text-muted">Hướng dẫn viên</p>
                  <p className="truncate font-semibold text-text">{service.guide.displayName}</p>
                  {service.guide.handle && <p className="truncate text-sm text-text-muted">@{service.guide.handle}</p>}
                </div>
                {service.guide.handle && (
                  <Link href={`/profile/${service.guide.handle}`}>
                    <Button variant="outline" size="sm">Xem hồ sơ</Button>
                  </Link>
                )}
              </Card>
            )}

            {/* Booking */}
            <Card className="p-5 sm:p-6">
              <h2 className="mb-4 text-lg font-semibold text-text">Đặt tour</h2>

              {bookingLoading ? (
                <div className="flex items-center justify-center py-6">
                  <div className="relative h-7 w-7">
                    <div className="absolute inset-0 rounded-full border-2 border-border" />
                    <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-secondary" />
                  </div>
                </div>
              ) : existingBooking && !booked ? (
                <div className="space-y-4">
                  {/* Đã đặt banner */}
                  <div className="flex items-start gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                    <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-emerald-400" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text">Bạn đã đặt tour này</p>
                      <div className="mt-2 space-y-1 text-sm text-text-muted">
                        {existingBooking.travelDates?.from && (
                          <p className="flex items-center gap-1.5">
                            <CalendarDays size={13} className="text-text-muted/60" />
                            Ngày đi: {new Date(existingBooking.travelDates.from).toLocaleDateString('vi-VN')}
                          </p>
                        )}
                        {existingBooking.pax?.adults && (
                          <p className="flex items-center gap-1.5">
                            <Users size={13} className="text-text-muted/60" />
                            Số người: {existingBooking.pax.adults}
                          </p>
                        )}
                        {existingBooking.message && (
                          <p className="flex items-start gap-1.5">
                            <span className="mt-0.5 shrink-0 text-text-muted/60">✎</span>
                            Ghi chú: {existingBooking.message}
                          </p>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          existingBooking.status === 'won' ? 'bg-emerald-500/15 text-emerald-400' :
                          existingBooking.status === 'lost' ? 'bg-red-500/15 text-red-400' :
                          existingBooking.status === 'quoted' ? 'bg-blue-500/15 text-blue-400' :
                          existingBooking.status === 'contacted' ? 'bg-violet-500/15 text-violet-400' :
                          'bg-amber-500/15 text-amber-400'
                        }`}>
                          {STATUS_LABELS[existingBooking.status] ?? existingBooking.status}
                        </span>
                      </div>
                    </div>
                    {['new', 'contacted'].includes(existingBooking.status) && !editing && (
                      <button
                        onClick={openEdit}
                        className="shrink-0 rounded-lg border border-border p-2 text-text-muted transition-colors hover:border-secondary hover:text-secondary"
                        title="Chỉnh sửa yêu cầu"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                  </div>

                  {/* Form chỉnh sửa inline */}
                  {editing && (
                    <form onSubmit={handleUpdate} className="space-y-4 rounded-xl border border-border/60 bg-surface-2/40 p-4">
                      <p className="text-sm font-medium text-text">Chỉnh sửa yêu cầu</p>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className={field}>Ngày đi</label>
                          <Input type="date" value={editDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setEditDate(e.target.value)} />
                        </div>
                        <div>
                          <label className={field}>Số người</label>
                          <Input type="number" min={1} max={service.maxPax ?? undefined} value={editPax} onChange={(e) => setEditPax(Math.max(1, Number(e.target.value) || 1))} />
                        </div>
                      </div>
                      <div>
                        <label className={field}>Ghi chú</label>
                        <Textarea placeholder="Yêu cầu đặc biệt, điểm đón, v.v." value={editNote} onChange={(e) => setEditNote(e.target.value)} maxLength={2000} maxHeight={240} />
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div>
                          <label className={field}>Họ tên</label>
                          <Input placeholder="Tên của bạn" value={editContactName} onChange={(e) => setEditContactName(e.target.value)} maxLength={100} />
                        </div>
                        <div>
                          <label className={field}>Số điện thoại</label>
                          <Input placeholder="Số điện thoại" value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} maxLength={50} />
                        </div>
                        <div>
                          <label className={field}>Email</label>
                          <Input type="email" placeholder="Email" value={editContactEmail} onChange={(e) => setEditContactEmail(e.target.value)} maxLength={200} />
                        </div>
                      </div>
                      {editError && <p className="text-sm text-danger">{editError}</p>}
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setEditing(false)}>Hủy</Button>
                        <Button type="submit" loading={editSubmitting}>Lưu thay đổi</Button>
                      </div>
                    </form>
                  )}
                </div>
              ) : booked ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <CheckCircle2 size={44} className="text-emerald-400" />
                  <div>
                    <p className="font-semibold text-text">Đặt tour thành công!</p>
                    <p className="mt-1 text-sm text-text-muted">Hướng dẫn viên sẽ liên hệ với bạn để xác nhận chi tiết.</p>
                  </div>
                </div>
              ) : service.status === 'paused' ? (
                <div className="rounded-xl border border-border/60 bg-surface-2/60 p-5 text-center">
                  <p className="font-medium text-text">Dịch vụ tạm ngừng nhận đặt tour</p>
                  <p className="mt-1 text-sm text-text-muted">Hướng dẫn viên đang tạm ngừng nhận yêu cầu. Vui lòng quay lại sau.</p>
                </div>
              ) : !isLoggedIn ? (
                <div className="flex flex-col items-center gap-3 py-6 text-center">
                  <p className="text-sm text-text-muted">Đăng nhập để đặt tour này.</p>
                  <Link href="/login"><Button>Đăng nhập để đặt tour</Button></Link>
                </div>
              ) : !isTraveler ? (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
                  <p className="text-sm text-amber-400">Chỉ tài khoản traveler mới có thể đặt tour.</p>
                </div>
              ) : (
                <form onSubmit={handleBook} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className={field}>Ngày đi *</label>
                      <Input type="date" value={travelDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setTravelDate(e.target.value)} required />
                    </div>
                    <div>
                      <label className={field}>Số người</label>
                      <Input type="number" min={1} max={service.maxPax ?? undefined} value={pax} onChange={(e) => setPax(Math.max(1, Number(e.target.value) || 1))} />
                    </div>
                  </div>

                  <div>
                    <label className={field}>Ghi chú</label>
                    <Textarea placeholder="Yêu cầu đặc biệt, điểm đón, v.v. (không bắt buộc)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} maxHeight={240} />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className={field}>Họ tên</label>
                      <Input placeholder="Tên của bạn" value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={100} />
                    </div>
                    <div>
                      <label className={field}>Số điện thoại</label>
                      <Input placeholder="Số điện thoại" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} maxLength={50} />
                    </div>
                    <div>
                      <label className={field}>Email</label>
                      <Input type="email" placeholder="Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} maxLength={200} />
                    </div>
                  </div>

                  {bookingError && <p className="text-sm text-danger">{bookingError}</p>}

                  <div className="flex items-center justify-between gap-4 pt-1">
                    <div className="flex items-center gap-1.5 text-sm text-text-muted">
                      <CalendarDays size={15} className="text-text-muted/60" />
                      {pax} người · {formatPrice(service.price)}
                    </div>
                    <Button type="submit" size="lg" loading={submitting}>Đặt tour</Button>
                  </div>
                </form>
              )}
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}