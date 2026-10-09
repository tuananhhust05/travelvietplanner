'use client';

import { useRef, useState } from 'react';
import { ImagePlus, MapPin, Sparkles, X, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { t, type Locale } from '@/lib/i18n';

export interface ComposerMedia {
  url: string;
  type: 'image' | 'video';
}

export interface ComposerPlace {
  name: string;
  lat?: number;
  lng?: number;
}

export interface ComposerPayload {
  body: string;
  media: ComposerMedia[];
  place: ComposerPlace | null;
}

interface ComposerProps {
  /** Called with the post body + media + place when the user submits. Should resolve when done. */
  onSubmit: (payload: ComposerPayload) => Promise<void>;
  /** Null when the visitor is not authenticated. */
  token: string | null;
  locale?: Locale;
}

export function Composer({ onSubmit, token, locale = 'vi' }: ComposerProps) {
  const { user } = useAuth();
  const [body, setBody] = useState('');
  const [media, setMedia] = useState<ComposerMedia[]>([]);
  const [place, setPlace] = useState<ComposerPlace | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const disabled = !body.trim() || busy || uploading;

  function requireLogin(): boolean {
    if (token) return true;
    setNotice(
      locale === 'vi' ? 'Vui lòng đăng nhập để đăng bài.' : 'Please log in to post.',
    );
    return false;
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!requireLogin()) return;
    setUploading(true);
    setNotice(null);
    try {
      const uploaded: ComposerMedia[] = [];
      for (const file of Array.from(files).slice(0, 10 - media.length)) {
        const { url } = await api.uploadFile(file, token!);
        uploaded.push({ url, type: file.type.startsWith('video') ? 'video' : 'image' });
      }
      setMedia((prev) => [...prev, ...uploaded]);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function removeMedia(index: number) {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleLocate() {
    if (!requireLogin()) return;
    if (!('geolocation' in navigator)) {
      setNotice(
        locale === 'vi'
          ? 'Trình duyệt không hỗ trợ định vị.'
          : 'Geolocation is not supported by this browser.',
      );
      return;
    }
    setLocating(true);
    setNotice(null);
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        }),
      );
      const { latitude: lat, longitude: lng } = pos.coords;
      // Resolve commune/province from our own admin boundary data. Never fall back
      // to raw coordinates as the display name — the coords still travel in lat/lng.
      let name = locale === 'vi' ? 'Vị trí hiện tại' : 'Current location';
      try {
        const { address } = await api.resolveAddress(lat, lng);
        if (address?.label) name = address.label;
      } catch {
        // keep the generic label
      }
      setPlace({ name, lat, lng });
    } catch {
      setNotice(
        locale === 'vi'
          ? 'Không lấy được vị trí. Vui lòng bật định vị và thử lại.'
          : 'Could not get your location. Please enable location and retry.',
      );
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit() {
    if (!requireLogin()) return;
    if (!body.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      await onSubmit({ body: body.trim(), media, place });
      setBody('');
      setMedia([]);
      setPlace(null);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex gap-4">
        <Avatar
          name={user?.displayName ?? 'Bạn'}
          src={user?.avatarUrl}
          accountType={user?.activeProfileType ?? 'traveler'}
          size={36}
          className="ring-offset-surface-1"
        />
        <div className="min-w-0 flex-1">
          <label htmlFor="composer-body" className="sr-only">
            {t(locale, 'feed.compose')}
          </label>
          <Textarea
            id="composer-body"
            rows={3}
            placeholder={t(locale, 'feed.compose')}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={5000}
            maxHeight={400}
            className="border-0 bg-transparent px-0 py-1 text-[15px] focus-visible:ring-0"
          />

          {/* Image previews */}
          {media.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {media.map((m, i) => (
                <div
                  key={m.url}
                  className="relative h-20 w-20 overflow-hidden rounded-lg border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt="" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeMedia(i)}
                    aria-label={locale === 'vi' ? 'Xóa ảnh' : 'Remove photo'}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white hover:bg-black/80"
                  >
                    <X size={12} aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Attached place */}
          {place && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-sm text-text">
              <MapPin size={14} className="text-primary" aria-hidden />
              <span className="max-w-[220px] truncate">{place.name}</span>
              <button
                type="button"
                onClick={() => setPlace(null)}
                aria-label={locale === 'vi' ? 'Bỏ vị trí' : 'Remove location'}
                className="ml-1 text-text-muted hover:text-text"
              >
                <X size={13} aria-hidden />
              </button>
            </div>
          )}

          {notice && (
            <p role="alert" className="mt-1 text-sm text-danger">
              {notice}
            </p>
          )}

          <div className="mt-3 flex items-center gap-1 border-t border-border pt-3">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <button
              type="button"
              aria-label={locale === 'vi' ? 'Thêm ảnh' : 'Add photo'}
              onClick={() => fileRef.current?.click()}
              disabled={uploading || media.length >= 10}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              {uploading ? (
                <Loader2 size={18} className="animate-spin" aria-hidden />
              ) : (
                <ImagePlus size={18} aria-hidden />
              )}
            </button>
            <button
              type="button"
              aria-label={locale === 'vi' ? 'Gắn vị trí' : 'Attach location'}
              onClick={() => void handleLocate()}
              disabled={locating}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
            >
              {locating ? (
                <Loader2 size={18} className="animate-spin" aria-hidden />
              ) : (
                <MapPin size={18} aria-hidden />
              )}
            </button>
            <button
              type="button"
              aria-label={locale === 'vi' ? 'Gợi ý bằng AI' : 'AI suggest'}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Sparkles size={18} aria-hidden />
            </button>
            <Button
              size="sm"
              className="ml-auto"
              onClick={() => void handleSubmit()}
              disabled={disabled}
              loading={busy}
            >
              {t(locale, 'feed.post')}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}