'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Save,
  Tag,
  DollarSign,
  Clock,
  Users,
  MapPin,
  FileText,
  ChevronDown,
  ImagePlus,
  Video,
  X,
  Loader2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import {
  AddressPicker,
  addressValueLabel,
  type AddressValue,
} from '@/components/form/AddressPicker';
import { Textarea } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

const CATEGORIES = [
  { value: 'tour', label: 'Tour' },
  { value: 'hiking', label: 'Leo núi' },
  { value: 'city', label: 'Tham quan thành phố' },
  { value: 'food', label: 'Ẩm thực' },
  { value: 'culture', label: 'Văn hóa' },
  { value: 'adventure', label: 'Phiêu lưu' },
  { value: 'other', label: 'Khác' },
];

export default function NewServicePage() {
  const { isLoggedIn, loading } = useAuth();
  const router = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('tvp_token') : null;
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'tour',
    price: '',
    duration: '',
    maxPax: '',
  });
  const [address, setAddress] = useState<AddressValue>({ province: '', commune: '' });
  const [addressStreet, setAddressStreet] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [gallery, setGallery] = useState<string[]>([]);
  const [video, setVideo] = useState('');
  const [uploading, setUploading] = useState<'cover' | 'gallery' | 'video' | null>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function uploadOne(file: File): Promise<string> {
    const { url } = await api.uploadFile(file, token!);
    return url;
  }

  async function handleCover(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading('cover');
    setError(null);
    try {
      const url = await uploadOne(files[0]);
      setCoverImage(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload ảnh đại diện thất bại');
    } finally {
      setUploading(null);
      if (coverRef.current) coverRef.current.value = '';
    }
  }

  async function handleGallery(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading('gallery');
    setError(null);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 10 - gallery.length)) {
        urls.push(await uploadOne(file));
      }
      setGallery((prev) => [...prev, ...urls]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload ảnh minh họa thất bại');
    } finally {
      setUploading(null);
      if (galleryRef.current) galleryRef.current.value = '';
    }
  }

  async function handleVideo(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading('video');
    setError(null);
    try {
      const url = await uploadOne(files[0]);
      setVideo(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload video thất bại');
    } finally {
      setUploading(null);
      if (videoRef.current) videoRef.current.value = '';
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Vui lòng nhập tên dịch vụ');
      return;
    }
    setSubmitting(true);
    setError(null);
    const adminPart = addressValueLabel(address);
    const street = addressStreet.trim();
    const fullLocation = [street, adminPart].filter(Boolean).join(', ');
    try {
      await api.createService({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        price: form.price ? Number(form.price) : undefined,
        duration: form.duration.trim(),
        location: fullLocation || undefined,
        maxPax: form.maxPax ? Number(form.maxPax) : undefined,
        coverImage: coverImage || undefined,
        images: gallery.length > 0 ? gallery : undefined,
        video: video || undefined,
      });
      router.push('/services');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tạo dịch vụ thất bại');
      setSubmitting(false);
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
            href="/services"
            className="group mb-4 inline-flex items-center gap-2 text-sm text-text-muted transition-colors duration-200 hover:text-text"
          >
            <ArrowLeft
              size={15}
              className="transition-transform duration-200 group-hover:-translate-x-0.5"
            />
            Quay lại dịch vụ
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-text">Thêm dịch vụ mới</h1>
          <p className="mt-1.5 text-sm text-text-muted">
            Tạo tour hoặc dịch vụ hướng dẫn để khách hàng đặt chỗ.
          </p>
        </div>

        {/* Form card */}
        <form
          onSubmit={handleSubmit}
          className="overflow-hidden rounded-2xl border border-border bg-surface-1/80 shadow-xl shadow-black/20 backdrop-blur-xl"
        >
          {/* Error banner */}
          {error && (
            <div className="border-b border-red-500/20 bg-red-500/10 px-6 py-3.5 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-6 p-6">
            {/* Section: Thông tin cơ bản */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <FileText size={13} className="text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Thông tin cơ bản
                </span>
              </div>

              <div>
                <label className={labelCls}>
                  Tên dịch vụ <span className="text-red-400">*</span>
                </label>
                <input
                  className={inputCls}
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="VD: Tour Hạ Long 2 ngày 1 đêm"
                  maxLength={200}
                />
              </div>

              <div>
                <label className={labelCls}>Mô tả</label>
                <Textarea
                  className={inputCls}
                  value={form.description}
                  onChange={(e) => update('description', e.target.value)}
                  placeholder="Mô tả chi tiết về tour, lịch trình, điểm nổi bật..."
                  maxLength={5000}
                  maxHeight={400}
                />
              </div>
            </div>

            <div className="border-t border-border/50" />

            {/* Section: Chi tiết dịch vụ */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Tag size={13} className="text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Chi tiết dịch vụ
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
                        <option key={c.value} value={c.value}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                    />
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
                    placeholder="VD: 1500000"
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    <Clock size={12} className="text-text-muted" /> Thời lượng
                  </label>
                  <input
                    className={inputCls}
                    value={form.duration}
                    onChange={(e) => update('duration', e.target.value)}
                    placeholder="VD: 2 ngày 1 đêm"
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    <Users size={12} className="text-text-muted" /> Số khách tối đa
                  </label>
                  <input
                    className={inputCls}
                    type="number"
                    min="1"
                    value={form.maxPax}
                    onChange={(e) => update('maxPax', e.target.value)}
                    placeholder="VD: 10"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border/50" />

            {/* Section: Hình ảnh & video */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ImagePlus size={13} className="text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Hình ảnh & video
                </span>
              </div>

              {/* Ảnh đại diện */}
              <div>
                <label className={labelCls}>
                  <ImagePlus size={12} className="text-text-muted" /> Ảnh đại diện
                </label>
                <input
                  ref={coverRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => void handleCover(e.target.files)}
                />
                {coverImage ? (
                  <div className="relative overflow-hidden rounded-xl border border-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverImage} alt="Ảnh đại diện" className="h-44 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setCoverImage('')}
                      aria-label="Xóa ảnh đại diện"
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => coverRef.current?.click()}
                    disabled={uploading !== null}
                    className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-text-muted transition-colors hover:border-emerald-500/50 hover:text-text disabled:opacity-50"
                  >
                    {uploading === 'cover' ? (
                      <Loader2 size={20} className="animate-spin" aria-hidden />
                    ) : (
                      <ImagePlus size={20} aria-hidden />
                    )}
                    <span className="text-sm">{uploading === 'cover' ? 'Đang tải…' : 'Tải ảnh đại diện'}</span>
                  </button>
                )}
              </div>

              {/* Ảnh minh họa */}
              <div>
                <label className={labelCls}>
                  <ImagePlus size={12} className="text-text-muted" /> Ảnh minh họa
                  <span className="font-normal text-text-muted/60"> (tối đa 10)</span>
                </label>
                <input
                  ref={galleryRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => void handleGallery(e.target.files)}
                />
                {gallery.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-2">
                    {gallery.map((url, i) => (
                      <div
                        key={url}
                        className="relative h-20 w-20 overflow-hidden rounded-lg border border-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setGallery((prev) => prev.filter((_, idx) => idx !== i))}
                          aria-label="Xóa ảnh"
                          className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                        >
                          <X size={12} aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  disabled={uploading !== null || gallery.length >= 10}
                  className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-text-muted transition-colors hover:border-emerald-500/50 hover:text-text disabled:opacity-50"
                >
                  {uploading === 'gallery' ? (
                    <Loader2 size={20} className="animate-spin" aria-hidden />
                  ) : (
                    <ImagePlus size={20} aria-hidden />
                  )}
                  <span className="text-sm">{uploading === 'gallery' ? 'Đang tải…' : 'Thêm ảnh minh họa'}</span>
                </button>
              </div>

              {/* Video */}
              <div>
                <label className={labelCls}>
                  <Video size={12} className="text-text-muted" /> Video giới thiệu
                </label>
                <input
                  ref={videoRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => void handleVideo(e.target.files)}
                />
                {video ? (
                  <div className="relative overflow-hidden rounded-xl border border-border">
                    <video src={video} controls className="h-44 w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setVideo('')}
                      aria-label="Xóa video"
                      className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
                    >
                      <X size={14} aria-hidden />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => videoRef.current?.click()}
                    disabled={uploading !== null}
                    className="flex h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border text-text-muted transition-colors hover:border-emerald-500/50 hover:text-text disabled:opacity-50"
                  >
                    {uploading === 'video' ? (
                      <Loader2 size={20} className="animate-spin" aria-hidden />
                    ) : (
                      <Video size={20} aria-hidden />
                    )}
                    <span className="text-sm">{uploading === 'video' ? 'Đang tải…' : 'Tải video giới thiệu'}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="border-t border-border/50" />

            {/* Section: Địa điểm */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <MapPin size={13} className="text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">
                  Địa điểm{' '}
                  <span className="normal-case font-normal text-text-muted/60">(tuỳ chọn)</span>
                </span>
              </div>

              <div>
                <label htmlFor="svc-street" className={labelCls}>
                  Số nhà / đường
                </label>
                <input
                  id="svc-street"
                  className={inputCls}
                  value={addressStreet}
                  onChange={(e) => setAddressStreet(e.target.value)}
                  placeholder="VD: 123 Lê Lợi"
                />
              </div>
              <AddressPicker value={address} onChange={setAddress} idPrefix="svc" />
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-3 border-t border-border/60 bg-surface-2/40 px-6 py-4">
            <button
              type="button"
              onClick={() => router.push('/services')}
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
              {submitting ? 'Đang lưu…' : 'Lưu dịch vụ'}
            </button>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
