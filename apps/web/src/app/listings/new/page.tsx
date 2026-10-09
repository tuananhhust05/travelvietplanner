'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Tag,
  DollarSign,
  Clock,
  Phone,
  Globe,
  MapPin,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import {
  AddressPicker,
  addressValueLabel,
  type AddressValue,
} from '@/components/form/AddressPicker';
import { Textarea } from '@/components/ui/input';
import { api } from '@/lib/api';

const CATEGORIES = [
  { value: 'hotel', label: 'Khách sạn' },
  { value: 'restaurant', label: 'Nhà hàng' },
  { value: 'attraction', label: 'Điểm tham quan' },
  { value: 'cafe', label: 'Cà phê' },
  { value: 'resort', label: 'Resort' },
  { value: 'spa', label: 'Spa' },
  { value: 'shopping', label: 'Mua sắm' },
  { value: 'transport', label: 'Di chuyển' },
  { value: 'other', label: 'Khác' },
];

export default function NewListingPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'hotel',
    price: '',
    phone: '',
    website: '',
    openingHours: '',
  });
  const [address, setAddress] = useState<AddressValue>({ province: '', commune: '' });
  const [addressStreet, setAddressStreet] = useState('');

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Vui lòng nhập tên listing');
      return;
    }
    setSubmitting(true);
    setError(null);
    const adminPart = addressValueLabel(address);
    const street = addressStreet.trim();
    const fullLocation = [street, adminPart].filter(Boolean).join(', ');
    try {
      await api.createListing({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        category: form.category,
        price: form.price ? Number(form.price) : undefined,
        phone: form.phone.trim() || undefined,
        website: form.website.trim() || undefined,
        openingHours: form.openingHours.trim() || undefined,
        location: fullLocation || undefined,
      });
      router.push('/listings');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tạo listing thất bại');
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-border bg-surface-2/80 px-4 py-3 text-sm text-text ' +
    'placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all duration-200';
  const labelCls = 'mb-2 flex items-center gap-1.5 text-sm font-medium text-text';

  return (
    <AppShell>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href="/listings"
            className="group mb-4 inline-flex items-center gap-2 text-sm text-text-muted transition-colors duration-200 hover:text-text"
          >
            <ArrowLeft size={15} className="transition-transform duration-200 group-hover:-translate-x-0.5" />
            Quay lại listings
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-text">Thêm listing mới</h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Đăng khách sạn, nhà hàng, điểm tham quan hoặc dịch vụ của bạn.
          </p>
        </div>

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
                <FileText size={13} className="text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Thông tin cơ bản
                </span>
              </div>

              <div>
                <label className={labelCls}>
                  Tên listing <span className="text-red-400">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="VD: Khách sạn Mường Thanh Hội An"
                  maxLength={200}
                />
              </div>

              <div>
                <label className={labelCls}>Mô tả</label>
                <Textarea
                  className={inputCls}
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Mô tả về dịch vụ, tiện ích, điểm nổi bật..."
                  maxLength={5000}
                  maxHeight={400}
                />
              </div>
            </div>

            <div className="border-t border-border/50" />

            {/* Chi tiết */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Tag size={13} className="text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Chi tiết
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>
                    <Tag size={12} className="text-text-muted" /> Danh mục
                  </label>
                  <div className="relative">
                    <select
                      className={`${inputCls} appearance-none pr-9`}
                      value={form.category}
                      onChange={(e) => update('category', e.target.value)}
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>
                    <DollarSign size={12} className="text-text-muted" /> Giá (VND)
                  </label>
                  <input
                    className={inputCls}
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(e) => update('price', e.target.value)}
                    placeholder="VD: 500000"
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    <Phone size={12} className="text-text-muted" /> Số điện thoại
                  </label>
                  <input
                    className={inputCls}
                    value={form.phone}
                    onChange={(e) => update('phone', e.target.value)}
                    placeholder="VD: 0901234567"
                    maxLength={50}
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    <Globe size={12} className="text-text-muted" /> Website
                  </label>
                  <input
                    className={inputCls}
                    value={form.website}
                    onChange={(e) => update('website', e.target.value)}
                    placeholder="VD: https://example.com"
                    maxLength={300}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className={labelCls}>
                    <Clock size={12} className="text-text-muted" /> Giờ mở cửa
                  </label>
                  <input
                    className={inputCls}
                    value={form.openingHours}
                    onChange={(e) => update('openingHours', e.target.value)}
                    placeholder="VD: 8:00 - 22:00"
                    maxLength={100}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border/50" />

            {/* Địa điểm */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-primary" />
                <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Địa điểm <span className="normal-case font-normal text-text-muted/60">(tuỳ chọn)</span>
                </span>
              </div>

              <div>
                <label htmlFor="lst-street" className={labelCls}>Số nhà / đường</label>
                <input
                  id="lst-street"
                  className={inputCls}
                  value={addressStreet}
                  onChange={(e) => setAddressStreet(e.target.value)}
                  placeholder="VD: 123 Trần Phú"
                  maxLength={200}
                />
              </div>
              <AddressPicker value={address} onChange={setAddress} idPrefix="lst" />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-border/60 bg-surface-2/40 px-6 py-4">
            <button
              type="button"
              onClick={() => router.push('/listings')}
              className="rounded-xl px-4 py-2.5 text-sm font-medium text-text-muted transition-colors duration-200 hover:bg-surface-2 hover:text-text"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary/80 px-5 py-2.5 text-sm font-semibold text-primary-fg shadow-lg transition-all duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={15} />
              {submitting ? 'Đang lưu…' : 'Lưu listing'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
