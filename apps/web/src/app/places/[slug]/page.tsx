'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, ChevronLeft, Compass, CalendarDays, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface PlaceDetail {
  id: string;
  slug: string;
  name: { vi: string; en: string };
  type: string;
  region: string;
  geo: { lat: number; lng: number } | null;
  description: { vi: string; en: string };
  media: { coverUrl: string | null; gallery: string[] };
  bestSeason: unknown[];
  stats: { postCount: number };
  province: string;
  article: { summary: string | null; sourceUrl: string | null };
}

const TYPE_LABELS: Record<string, string> = {
  beach: 'Biển',
  mountain: 'Núi',
  attraction: 'Điểm tham quan',
  landmark: 'Di tích',
  island: 'Đảo',
  park: 'Công viên',
  area: 'Khu vực',
  province: 'Tỉnh/Thành phố',
};

const TYPE_GRADIENT: Record<string, string> = {
  beach: 'from-sky-600 via-cyan-600 to-teal-600',
  mountain: 'from-slate-700 via-stone-600 to-emerald-800',
  attraction: 'from-amber-600 via-orange-600 to-rose-700',
  landmark: 'from-rose-800 via-red-800 to-amber-800',
  island: 'from-emerald-700 via-teal-600 to-cyan-800',
  park: 'from-green-700 via-emerald-700 to-teal-800',
  area: 'from-teal-700 via-emerald-600 to-lime-700',
};

const DEFAULT_GRADIENT = 'from-slate-700 via-stone-600 to-amber-800';

export default function PlaceDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [place, setPlace] = useState<PlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/places/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: PlaceDetail) => {
        if (active) setPlace(data);
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Không thể tải điểm đến');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const gradient = place ? (TYPE_GRADIENT[place.type] ?? DEFAULT_GRADIENT) : DEFAULT_GRADIENT;
  const gallery = place?.media.gallery?.length ? place.media.gallery : place?.media.coverUrl ? [place.media.coverUrl] : [];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href="/explore" className="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition-colors hover:text-text">
          <ChevronLeft size={16} /> Khám phá
        </Link>

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-24 text-text-muted">
            <div className="relative h-10 w-10">
              <div className="absolute inset-0 rounded-full border-2 border-border" />
              <div className="absolute inset-0 animate-spin rounded-full border-2 border-t-secondary" />
            </div>
            <p className="text-sm">Đang tải điểm đến…</p>
          </div>
        ) : error ? (
          <Card className="border-danger/20 bg-danger/5 p-6 text-center">
            <p className="text-sm text-danger">{error}</p>
          </Card>
        ) : place ? (
          <>
            {/* Hero */}
            <div className="overflow-hidden rounded-2xl border border-border/50 bg-surface-1">
              <div className="relative h-72 w-full overflow-hidden bg-surface-2 sm:h-96">
                {place.media.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={place.media.coverUrl} alt={place.name.vi} className="h-full w-full object-cover" />
                ) : (
                  <div className={`flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br ${gradient}`}>
                    <Compass size={44} className="text-white/40" />
                    <p className="px-4 text-center text-lg font-semibold text-white/70">{place.name.vi}</p>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                  <Badge tone="primary" className="bg-black/40 text-white backdrop-blur-sm">
                    {place.region || 'Việt Nam'}
                  </Badge>
                  {place.type && (
                    <Badge className="bg-black/40 text-white backdrop-blur-sm">
                      {TYPE_LABELS[place.type] ?? place.type}
                    </Badge>
                  )}
                </div>
              </div>
              {gallery.length > 1 && (
                <div className="flex gap-2 overflow-x-auto p-3">
                  {gallery.map((img, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={img} alt={`${place.name.vi} ${i + 1}`} className="h-16 w-24 shrink-0 rounded-lg object-cover" />
                  ))}
                </div>
              )}
            </div>

            {/* Title + meta */}
            <div>
              <h1 className="text-2xl font-bold leading-snug text-text sm:text-3xl">{place.name.vi}</h1>
              {place.name.en && place.name.en !== place.name.vi && (
                <p className="mt-1 text-sm text-text-muted">{place.name.en}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-text-muted">
                {place.province && (
                  <span className="flex items-center gap-1.5"><MapPin size={15} className="text-text-muted/60" /> {place.province}</span>
                )}
                {place.stats.postCount > 0 && (
                  <span className="flex items-center gap-1.5"><ImageIcon size={15} className="text-text-muted/60" /> {place.stats.postCount} bài viết</span>
                )}
              </div>
            </div>

            {/* Description */}
            <Card className="p-5 sm:p-6">
              <h2 className="mb-3 text-lg font-semibold text-text">Giới thiệu</h2>
              <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-text-muted">
                {place.description.vi || 'Chưa có mô tả chi tiết cho điểm đến này.'}
              </p>
            </Card>

            {/* Article summary */}
            {place.article?.summary && (
              <Card className="p-5 sm:p-6">
                <h2 className="mb-3 text-lg font-semibold text-text">Tổng quan</h2>
                <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-text-muted">{place.article.summary}</p>
                {place.article.sourceUrl && (
                  <a
                    href={place.article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    Nguồn tham khảo <ExternalLink size={14} aria-hidden />
                  </a>
                )}
              </Card>
            )}

            {/* Map */}
            {place.geo && (
              <Card className="overflow-hidden p-0">
                <div className="flex items-center gap-2 border-b border-border px-5 py-3">
                  <MapPin size={16} className="text-primary" />
                  <h2 className="text-base font-semibold text-text">Bản đồ</h2>
                </div>
                <div className="relative h-72 w-full sm:h-96">
                  <iframe
                    title={`Bản đồ ${place.name.vi}`}
                    src={`https://maps.google.com/maps?q=${place.geo.lat},${place.geo.lng}&z=14&output=embed`}
                    className="h-full w-full border-0"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    allowFullScreen
                  />
                </div>
                <div className="flex items-center justify-end border-t border-border px-4 py-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${place.geo.lat},${place.geo.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                  >
                    Xem trên Google Maps <ExternalLink size={13} aria-hidden />
                  </a>
                </div>
              </Card>
            )}

            {/* Best season */}
            {place.bestSeason && place.bestSeason.length > 0 && (
              <Card className="p-5 sm:p-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-text">
                  <CalendarDays size={18} className="text-secondary" /> Mùa đẹp nhất
                </h2>
                <div className="flex flex-wrap gap-2">
                  {place.bestSeason.map((s, i) => (
                    <Badge key={i} tone="info">{String(s)}</Badge>
                  ))}
                </div>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </AppShell>
  );
}