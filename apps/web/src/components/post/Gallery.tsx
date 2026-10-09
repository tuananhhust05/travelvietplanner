'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/i18n';

export interface GallerySlide {
  /** Tailwind gradient classes for the placeholder slide (used when no url). */
  gradient: string;
  /** Bilingual-aware alt/caption text. */
  alt: { vi: string; en: string };
  /** Optional real image URL — when present, renders the image instead of the gradient. */
  url?: string;
}

interface GalleryProps {
  slides: GallerySlide[];
  place: string;
  locale?: Locale;
}

export function Gallery({ slides, place, locale = 'vi' }: GalleryProps) {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const count = slides.length;

  const go = useCallback(
    (next: number) => {
      setDir(next > index ? 1 : -1);
      setIndex((next + count) % count);
    },
    [index, count],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') go(index - 1);
      if (e.key === 'ArrowRight') go(index + 1);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index]);

  const slide = slides[index];
  const altText = locale === 'vi' ? slide.alt.vi : slide.alt.en;

  return (
    <section
      aria-roledescription={locale === 'vi' ? 'Bộ ảnh' : 'Image carousel'}
      aria-label={
        locale === 'vi' ? `Ảnh của ${place}` : `Photos of ${place}`
      }
      className="flex flex-col gap-3"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border shadow-e2">
        <div className="relative aspect-[4/3] w-full sm:aspect-[3/2]">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <motion.div
              key={index}
              custom={dir}
              role="group"
              aria-roledescription={locale === 'vi' ? 'ảnh' : 'slide'}
              aria-label={`${index + 1} / ${count} — ${altText}`}
              initial={reduce ? false : { opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.32, ease: [0.4, 0, 0.2, 1] }}
              className={cn('absolute inset-0', !slide.url && slide.gradient)}
            >
              {slide.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slide.url}
                  alt={altText}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              )}
              <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/45 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                <MapPin size={13} aria-hidden />
                {place}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Nav buttons */}
        <button
          type="button"
          onClick={() => go(index - 1)}
          aria-label={locale === 'vi' ? 'Ảnh trước' : 'Previous image'}
          className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronLeft size={20} aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => go(index + 1)}
          aria-label={locale === 'vi' ? 'Ảnh kế tiếp' : 'Next image'}
          className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ChevronRight size={20} aria-hidden />
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          {slides.map((_, i) => (
            <span
              key={i}
              aria-hidden
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === index ? 'w-4 bg-white' : 'w-1.5 bg-white/50',
              )}
            />
          ))}
        </div>
      </div>

      {/* Thumbnail strip */}
      <ul className="flex gap-2 overflow-x-auto pb-1 scroll-x-styled">
        {slides.map((s, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => go(i)}
              aria-label={
                locale === 'vi' ? `Xem ảnh ${i + 1}` : `View image ${i + 1}`
              }
              aria-current={i === index ? 'true' : undefined}
              className={cn(
                'h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition',
                !s.url && s.gradient,
                i === index
                  ? 'border-primary'
                  : 'border-transparent opacity-70 hover:opacity-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              {s.url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.url} alt="" className="h-full w-full object-cover" />
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
