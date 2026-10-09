'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, RotateCcw, MapPin } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { CategoryChips } from '@/components/explore/CategoryChips';
import { DestinationBento, type Destination } from '@/components/explore/DestinationBento';
import { CollectionRow, type CollectionItem } from '@/components/explore/CollectionRow';
import { t } from '@/lib/i18n';

const CATEGORIES = [
  'Tất cả',
  'Miền Bắc',
  'Miền Trung',
  'Miền Nam',
  'Biển',
  'Núi',
  'Ẩm thực',
  'Di sản',
] as const;

// Gradient by place type
const TYPE_GRADIENT: Record<string, string> = {
  beach:      'from-sky-600 via-cyan-600 to-teal-600',
  mountain:   'from-slate-700 via-stone-600 to-emerald-800',
  attraction: 'from-amber-600 via-orange-600 to-rose-700',
  landmark:   'from-rose-800 via-red-800 to-amber-800',
  island:     'from-emerald-700 via-teal-600 to-cyan-800',
  park:       'from-green-700 via-emerald-700 to-teal-800',
  area:       'from-teal-700 via-emerald-600 to-lime-700',
};

// Category name -> type or region
const CATEGORY_TYPE: Record<string, string> = {
  'Biển':     'beach',
  'Núi':      'mountain',
  'Di sản':   'landmark',
};

const DEFAULT_GRADIENT = 'from-slate-700 via-stone-600 to-amber-800';

// Bento span pattern cycles
const SPAN_PATTERN = [
  'md:col-span-2 md:row-span-2',
  'md:col-span-2 md:row-span-1',
  'md:col-span-1 md:row-span-1',
  'md:col-span-1 md:row-span-2',
  'md:col-span-2 md:row-span-1',
  'md:col-span-1 md:row-span-1',
];

const COLLECTIONS: { title: string; subtitle: string; items: CollectionItem[] }[] = [
  {
    title: 'Cung đường di sản miền Trung',
    subtitle: 'Huế - Hội An - Mỹ Sơn trong một hành trình',
    items: [
      { id: 'c1-1', name: 'Đại Nội Huế',      meta: '2 ngày', gradient: 'from-rose-800 to-amber-700' },
      { id: 'c1-2', name: 'Phố cổ Hội An',    meta: '2 ngày', gradient: 'from-amber-600 to-orange-700' },
      { id: 'c1-3', name: 'Thánh địa Mỹ Sơn', meta: '1 ngày', gradient: 'from-stone-700 to-emerald-800' },
      { id: 'c1-4', name: 'Bà Nà Hills',       meta: '1 ngày', gradient: 'from-emerald-700 to-teal-800' },
    ],
  },
  {
    title: 'Trekking Tây Bắc',
    subtitle: 'Chinh phục mây núi và ruộng bậc thang',
    items: [
      { id: 'c2-1', name: 'Fansipan',         meta: 'Khó',  gradient: 'from-slate-700 to-emerald-800' },
      { id: 'c2-2', name: 'Tà Xùa săn mây',  meta: 'Vừa',  gradient: 'from-teal-700 to-cyan-800' },
      { id: 'c2-3', name: 'Mù Cang Chải',     meta: 'Dễ',   gradient: 'from-lime-700 to-emerald-700' },
      { id: 'c2-4', name: 'Y Tý',             meta: 'Vừa',  gradient: 'from-emerald-800 to-teal-700' },
    ],
  },
  {
    title: 'Food tour Sài Gòn',
    subtitle: 'Ăn sập thành phố không ngủ',
    items: [
      { id: 'c3-1', name: 'Cơm tấm Bà Chiểu',   meta: 'Sáng', gradient: 'from-orange-700 to-rose-700' },
      { id: 'c3-2', name: 'Bánh mì Huỳnh Hoa',  meta: 'Trưa', gradient: 'from-amber-600 to-red-700' },
      { id: 'c3-3', name: 'Phố lẩu Vĩnh Khánh', meta: 'Tối',  gradient: 'from-rose-700 to-pink-800' },
      { id: 'c3-4', name: 'Cà phê chung cư',    meta: 'Xế',   gradient: 'from-stone-700 to-amber-800' },
    ],
  },
];

interface ApiPlace {
  id: string;
  slug: string;
  name: { vi: string; en: string };
  type: string;
  region: string;
  description: { vi: string };
  province: string;
}

type Status = 'loading' | 'ready' | 'error';

function mapToDestination(place: ApiPlace, index: number): Destination {
  return {
    id: place.id,
    slug: place.slug,
    name: place.name.vi,
    blurb: place.description.vi || place.province,
    region: place.region,
    category: CATEGORY_TYPE[place.type] ?? place.type,
    gradient: TYPE_GRADIENT[place.type] ?? DEFAULT_GRADIENT,
    span: SPAN_PATTERN[index % SPAN_PATTERN.length],
  };
}

export default function ExplorePage() {
  const [active, setActive] = useState<string>('Tất cả');
  const [status, setStatus] = useState<Status>('loading');
  const [places, setPlaces] = useState<ApiPlace[]>([]);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    async function load() {
      try {
        const res = await fetch('/api/v1/places?limit=50');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { items: ApiPlace[] };
        if (!cancelled) {
          setPlaces(data.items);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  const destinations = useMemo<Destination[]>(() => {
    return places.map((p, i) => mapToDestination(p, i));
  }, [places]);

  const filtered = useMemo(() => {
    if (active === 'Tất cả') return destinations;
    // Region filter (Miền Bắc/Trung/Nam)
    if (['Miền Bắc', 'Miền Trung', 'Miền Nam'].includes(active)) {
      return destinations.filter((d) => d.region === active);
    }
    // Category filter
    const typeKey = CATEGORY_TYPE[active];
    return destinations.filter((d) => d.category === active || (typeKey && d.category === typeKey));
  }, [active, destinations]);

  return (
    <AppShell>
      <div className="space-y-8">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-primary">
            {t('vi', 'nav.explore')}
          </p>
          <h1 className="text-4xl font-bold text-text text-balance md:text-5xl font-display">
            {t('vi', 'explore.title')}
          </h1>
          <p className="max-w-xl text-text-muted text-pretty">
            Từ vịnh biển ngọc bích đến cao nguyên đá — chọn chủ đề để tìm cảm hứng cho chuyến đi tiếp theo.
          </p>
        </header>

        <CategoryChips categories={CATEGORIES} active={active} onChange={setActive} />

        {status === 'error' ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-3 rounded-2xl border border-danger/30 bg-danger/10 px-6 py-16 text-center"
          >
            <AlertCircle className="text-danger" aria-hidden />
            <p className="text-text">Không tải được điểm đến. Vui lòng thử lại.</p>
            <Button variant="outline" onClick={() => setStatus('loading')}>
              <RotateCcw size={16} aria-hidden />
              {t('vi', 'common.retry')}
            </Button>
          </div>
        ) : status === 'loading' ? (
          <DestinationBento destinations={[]} loading />
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-1 px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-text-muted">
              <MapPin size={22} aria-hidden />
            </span>
            <p className="max-w-xs text-text-muted text-pretty">{t('vi', 'explore.empty')}</p>
            <Button variant="ghost" onClick={() => setActive('Tất cả')}>
              Bỏ bộ lọc
            </Button>
          </div>
        ) : (
          <DestinationBento destinations={filtered} />
        )}

        <section className="space-y-8 pt-4">
          <h2 className="text-2xl font-semibold text-text text-balance">
            {t('vi', 'explore.collections')}
          </h2>
          {COLLECTIONS.map((c) => (
            <CollectionRow key={c.title} title={c.title} subtitle={c.subtitle} items={c.items} />
          ))}
        </section>
      </div>
    </AppShell>
  );
}
