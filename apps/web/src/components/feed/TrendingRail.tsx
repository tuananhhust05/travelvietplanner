'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { TrendingUp, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { t, useLocale } from '@/lib/i18n';

const SWATCHES = [
  'bg-gradient-to-br from-emerald-500 to-teal-700',
  'bg-gradient-to-br from-amber-400 to-orange-600',
  'bg-gradient-to-br from-cyan-500 to-blue-700',
  'bg-gradient-to-br from-pink-400 to-rose-600',
  'bg-gradient-to-br from-sky-400 to-indigo-700',
  'bg-gradient-to-br from-violet-500 to-purple-700',
  'bg-gradient-to-br from-lime-400 to-green-600',
];

function shortName(province: string): string {
  return province.replace(/^(Tỉnh |Thành phố )/i, '');
}

function regionLabel(province: string): string {
  const name = province.toLowerCase();
  if (['hà nội', 'hải phòng', 'hưng yên', 'hà nam', 'nam định', 'ninh bình', 'thái bình', 'bắc ninh', 'bắc giang', 'vĩnh phúc', 'hải dương'].some(k => name.includes(k))) return 'Đồng bằng Bắc Bộ';
  if (['hà giang', 'cao bằng', 'bắc kạn', 'lạng sơn', 'lào cai', 'yên bái', 'tuyên quang', 'thái nguyên', 'phú thọ', 'sơn la', 'điện biên', 'lai châu', 'hòa bình'].some(k => name.includes(k))) return 'Miền núi phía Bắc';
  if (['thanh hóa', 'nghệ an', 'hà tĩnh', 'quảng bình', 'quảng trị', 'thừa thiên huế'].some(k => name.includes(k))) return 'Bắc Trung Bộ';
  if (['đà nẵng', 'quảng nam', 'quảng ngãi', 'bình định', 'phú yên', 'khánh hòa', 'ninh thuận', 'bình thuận'].some(k => name.includes(k))) return 'Nam Trung Bộ';
  if (['kon tum', 'gia lai', 'đắk lắk', 'đắk nông', 'lâm đồng'].some(k => name.includes(k))) return 'Tây Nguyên';
  if (['hồ chí minh', 'bình dương', 'đồng nai', 'bà rịa', 'bình phước', 'tây ninh', 'long an', 'tiền giang'].some(k => name.includes(k))) return 'Đông Nam Bộ';
  if (['cần thơ', 'an giang', 'kiên giang', 'cà mau', 'bạc liêu', 'sóc trăng', 'hậu giang', 'trà vinh', 'vĩnh long', 'bến tre', 'đồng tháp'].some(k => name.includes(k))) return 'Đồng bằng Sông Cửu Long';
  return 'Việt Nam';
}

interface ProvinceStat {
  province: string;
  count: number;
}

export function TrendingRail() {
  const locale = useLocale();
  const [stats, setStats] = useState<ProvinceStat[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/v1/posts/stats/provinces?limit=5')
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (active) setStats(data); })
      .catch(() => { if (active) setStats([]); });
    return () => { active = false; };
  }, []);

  const nf = new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US');

  if (stats === null) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3 px-2 py-2">
            <Skeleton className="h-4 w-4 rounded" />
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </Card>
    );
  }

  if (stats.length === 0) return null;

  return (
    <Card className="p-4">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-text">
        <TrendingUp size={16} className="text-primary" aria-hidden />
        {t(locale, 'feed.trending')}
      </h2>
      <ul className="mt-3 flex flex-col gap-1">
        {stats.map((item, i) => (
          <li key={item.province}>
            <Link
              href={`/explore?province=${encodeURIComponent(item.province)}`}
              className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="w-4 shrink-0 text-center text-sm font-bold text-text-muted">
                {i + 1}
              </span>
              <span
                className={`h-10 w-10 shrink-0 rounded-xl ${SWATCHES[i % SWATCHES.length]}`}
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-text">
                  {shortName(item.province)}
                </span>
                <span className="flex items-center gap-1 text-xs text-text-muted">
                  <MapPin size={11} aria-hidden />
                  {regionLabel(item.province)} · {nf.format(item.count)}{' '}
                  {locale === 'vi' ? 'bài' : 'posts'}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
