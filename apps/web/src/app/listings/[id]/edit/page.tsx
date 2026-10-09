'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Trash2,
  Tag,
  DollarSign,
  Phone,
  Globe,
  Clock,
  MapPin,
  FileText,
  ChevronDown,
  Loader2,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import {
  AddressPicker,
  addressValueLabel,
  parseAddressString,
  type AddressValue,
} from '@/components/form/AddressPicker';
import { Textarea } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const LISTING_CATEGORIES = [
  { value: 'restaurant', label: 'Nhà hàng / Quán ăn' },
  { value: 'hotel', label: 'Khách sạn / Lưu trú' },
  { value: 'activity', label: 'Hoạt động / Trải nghiệm' },
  { value: 'shopping', label: 'Mua sắm' },
  { value: 'spa', label: 'Spa / Làm đẹp' },
  { value: 'transport', label: 'Di chuyển' },
  { value: 'other', label: 'Khác' },
];

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const [loadingData, setLoadingData] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'restaurant',
    price: '',
    phone: '',
    website: '',
    openingHours: '',
  });
  const [address, setAddress] = useState<AddressValue>({ province: '', commune: '' });
  const [addressStreet, setAddressStreet] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [imageInput, setImageInput] = useState('');

  useEffect(() => {
    if (!id || !isLoggedIn) return;
    api
      .getListing(id)
      .then((l: any) => {
        setForm({
          title: l.title ?? '',
          description: l.description ?? '',
          category: l.category ?? 'restaurant',
          price: l.price ? String(l.price) : '',
          phone: l.phone ?? '',
          website: l.website ?? '',
          openingHours: l.openingHours ?? '',
        });
        const parsed = parseAddressString(l.address ?? l.location ?? '');
        setAddress({ province: parsed.province, commune: parsed.commune });
        setAddressStreet(parsed.street);
        setImages(Array.isArray(l.images) ? l.images : []);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Không thể tải listing'))
      .finally(() => setLoadingData(false));
  }, [id, isLoggedIn]);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function addImage() {
    const url = imageInput.trim();
    if (url && !images.includes(url)) setImages((prev) => [...prev, url]);
    setImageInput('');
  }

  function removeImage(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Vui lòng nhập tên listing'); return; }
    setSubmitting(true);
    setError(null);
    const adminPart = addressValueLabel(address);
    const street = addressStreet.trim();
    const fullAddress = [street, adminPart].filter(Boolean).join(', ');
    try {
      await api.updateListing(id, {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        price: form.price ? Number(form.price) : undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        openingHours: form.openingHours.trim() || undefined,
        address: fullAddress || undefined,
        images: images.length > 0 ? images : undefined,
      });
      router.push('/listings');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cập nhật thất bại');
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm('Bạn có chắc muốn xóa listing này? Hành động không thể hoàn tác.')) return;
    setDeleting(true);
    setError(null);
    try {
      await api.deleteListing(id);
      router.push('/listings');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xóa thất bại');
      setDeleting(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-border bg-surface-2/80 px-4 py-3 text-sm text-text ' +
    'placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/50 transition-all duration-200';
  const labelCls = 'mb-2 flex items-center gap-1.5 text-sm font-medium text-text';

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/listings"
            className="group mb-4 inline-flex items-center gap-2 text-sm text-text-muted transition-colors duration-200 hover:text-text"
          >
            <ArrowLeft size={15} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
            Quay lại danh sách
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-text">Chỉnh sửa listing</h1>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center gap-3 py-20 text-text-muted">
            <Loader2 size={20} className="animate-spin text-emerald-500" />
            <p className="text-sm">Đang tải dữ liệu…</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="overflow-hidden rounded-2xl border border-border bg-surface-1/80 shadow-xl shadow-black/20 backdrop-blur-xl"
          >
            {error && (
              <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-3.5 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-6 p-6">
              {/* Thông tin cơ bản */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <FileText size={13} className="text-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">Thông tin cơ bản</span>
                </div>

                <div>
                  <label className={labelCls}>Tên listing <span className="text-red-400">*</span></label>
                  <input className={inputCls} value={form.title} onChange={(e) => update('title', e.target.value)} maxLength={200} />
                </div>

                <div>
                  <label className={labelCls}>Mô tả</label>
                  <Textarea className={inputCls} value={form.description} onChange={(e) => update('description', e.target.value)} maxLength={5000} maxHeight={400} />
                </div>
              </div>

              <div className="border-t border-border/50" />

              {/* Chi tiết */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Tag size={13} className="text-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">Chi tiết</span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}><Tag size={12} className="text-text-muted" /> Danh mục</label>
                    <div className="relative">
                      <select className={`${inputCls} appearance-none pr-9`} value={form.category} onChange={(e) => update('category', e.target.value)}>
                        {LISTING_CATEGORIES.map((c) => (
                          <option key={c.value} value={c.value}>{c.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}><DollarSign size={12} className="text-text-muted" /> Giá (VND)</label>
                    <input className={inputCls} type="number" min="0" value={form.price} onChange={(e) => update('price', e.target.value)} placeholder="VD: 200000" />
                  </div>

                  <div>
                    <label className={labelCls}><Phone size={12} className="text-text-muted" /> Số điện thoại</label>
                    <input className={inputCls} type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="VD: 0901234567" maxLength={50} />
                  </div>

                  <div>
                    <label className={labelCls}><Globe size={12} className="text-text-muted" /> Website</label>
                    <input className={inputCls} type="url" value={form.website} onChange={(e) => update('website', e.target.value)} placeholder="https://..." maxLength={300} />
                  </div>

                  <div className="sm:col-span-2">
                    <label className={labelCls}><Clock size={12} className="text-text-muted" /> Giờ mở cửa</label>
                    <input className={inputCls} value={form.openingHours} onChange={(e) => update('openingHours', e.target.value)} placeholder="VD: 7:00 – 22:00 hàng ngày" maxLength={100} />
                  </div>
                </div>
              </div>

              <div className="border-t border-border/50" />

              {/* Địa điểm */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <MapPin size={13} className="text-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                    Địa điểm <span className="normal-case font-normal text-text-muted/60">(tuỳ chọn)</span>
                  </span>
                </div>
                <div>
                  <label htmlFor="lst-street" className={labelCls}>Số nhà / đường</label>
                  {/* Street fragment only — saved `location` is street + ", " + admin
                    label, capped at 300 (listings.routes.ts:21). */}
                <input id="lst-street" className={inputCls} value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} placeholder="VD: 123 Lê Lợi" maxLength={200} />
                </div>
                <AddressPicker value={address} onChange={setAddress} idPrefix="lst" />
              </div>

              <div className="border-t border-border/50" />

              {/* Hình ảnh */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ImageIcon size={13} className="text-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                    Hình ảnh <span className="normal-case font-normal text-text-muted/60">(tuỳ chọn)</span>
                  </span>
                </div>

                {images.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {images.map((url) => (
                      <div key={url} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-border">
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeImage(url)}
                          aria-label="Xóa ảnh"
                          className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
                        >
                          <X size={16} className="text-white" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    className={`${inputCls} flex-1`}
                    value={imageInput}
                    onChange={(e) => setImageInput(e.target.value)}
                    placeholder="Dán URL ảnh rồi nhấn Thêm"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImage(); } }}
                  />
                  <button
                    type="button"
                    onClick={addImage}
                    className="rounded-xl border border-border bg-surface-2/80 px-4 py-3 text-sm font-medium text-text transition-colors hover:bg-surface-2"
                  >
                    Thêm
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 border-t border-border/60 bg-surface-2/40 px-6 py-4">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting || submitting}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-red-400 transition-colors duration-200 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Xóa listing
              </button>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.push('/listings')}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-text"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting || loading || !isLoggedIn}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:from-emerald-500 hover:to-emerald-400 hover:shadow-emerald-500/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={15} />
                  {submitting ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </AppShell>
  );
}
