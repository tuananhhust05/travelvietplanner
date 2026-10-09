'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { SearchPlaceResult } from '@/lib/api';

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

export function PlaceResult({ place }: { place: SearchPlaceResult }) {
  const subtitle = place.province || (TYPE_LABELS[place.type] ?? 'Địa điểm');
  const href = place.slug ? `/places/${place.slug}` : '/explore';

  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface-1 p-3 hover:bg-surface-2 transition-colors"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <MapPin size={18} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{place.name}</p>
        <p className="truncate text-xs text-text-muted">{subtitle}</p>
      </div>
      {place.type && (
        <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted">
          {TYPE_LABELS[place.type] ?? place.type}
        </span>
      )}
    </Link>
  );
}
