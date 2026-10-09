'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';

interface Destination {
  name: string;
  region: string;
  cover: string;
}

const DESTINATIONS: readonly Destination[] = [
  { name: 'Hà Giang', region: 'Cực Bắc', cover: 'linear-gradient(160deg,#047857,#10b981 60%,#6ee7b0)' },
  { name: 'Hạ Long', region: 'Quảng Ninh', cover: 'linear-gradient(160deg,#0e7490,#3b82f6 60%,#6ee7b0)' },
  { name: 'Hội An', region: 'Đà Nẵng', cover: 'linear-gradient(160deg,#b45309,#eab308 55%,#f472b6)' },
  { name: 'Đà Lạt', region: 'Lâm Đồng', cover: 'linear-gradient(160deg,#065f46,#22c55e 60%,#eab308)' },
  { name: 'Phong Nha', region: 'Quảng Trị', cover: 'linear-gradient(160deg,#1e3a5f,#059669 60%,#6ee7b0)' },
  { name: 'Phú Quốc', region: 'An Giang', cover: 'linear-gradient(160deg,#0369a1,#eab308 70%,#facc15)' },
] as const;

export function DestinationGallery({ locale = 'vi' }: { locale?: Locale }) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-label={t(locale, 'explore.title')}
      className="py-16 md:py-24"
    >
      <div className="mx-auto mb-8 max-w-6xl px-4 md:px-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t(locale, 'nav.explore')}
        </span>
        <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          {t(locale, 'explore.title')}
        </h2>
      </div>

      <motion.ul
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.4 }}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:px-6 scroll-x-styled"
        aria-label="Hàng cuộn các điểm đến"
      >
        {DESTINATIONS.map((d) => (
          <li
            key={d.name}
            className="group shrink-0 snap-center first:ml-0"
          >
            <div
              className="relative h-64 w-56 overflow-hidden rounded-2xl border border-border shadow-e2 transition-transform duration-slow ease-standard hover:scale-[1.04] sm:w-64"
              style={{ backgroundImage: d.cover }}
              role="img"
              aria-label={`${d.name}, ${d.region}`}
            >
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent"
              />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <p className="inline-flex items-center gap-1 text-xs font-medium text-white/80">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {d.region}
                </p>
                <h3 className="mt-0.5 text-xl font-semibold text-white">
                  {d.name}
                </h3>
              </div>
            </div>
          </li>
        ))}
      </motion.ul>
    </section>
  );
}
