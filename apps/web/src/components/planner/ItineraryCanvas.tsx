'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Map, PlusCircle, Route } from 'lucide-react';
import { DayCard, type ItineraryDay } from './DayCard';
import { CitationChip, type Citation } from './CitationChip';
import { Skeleton } from '@/components/ui/skeleton';
import type { Locale } from '@/lib/i18n';

export type { ItineraryDay } from './DayCard';

export function ItineraryCanvas({
  locale,
  days,
  citations,
  loading,
  destination,
  onCreateTrip,
}: {
  locale: Locale;
  days: ItineraryDay[];
  citations: Citation[];
  loading?: boolean;
  destination?: string;
  onCreateTrip?: () => void;
}) {
  const reduce = useReducedMotion();
  const hasContent = days.length > 0;
  const bannerImage = (citations as (Citation & { imageUrl?: string })[]).find((c) => c.imageUrl)?.imageUrl;

  return (
    <section aria-label={locale === 'vi' ? 'Lịch trình' : 'Itinerary'} className="flex h-full flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Route className="h-4 w-4" aria-hidden />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-text">
              {locale === 'vi' ? 'Lịch trình đề xuất' : 'Suggested itinerary'}
            </h2>
            <p className="text-xs text-text-muted">
              {hasContent
                ? `${days.length} ${locale === 'vi' ? 'ngày' : 'days'}${destination ? ` · ${destination}` : ''}`
                : locale === 'vi' ? 'Chưa có lịch trình' : 'No itinerary yet'}
            </p>
          </div>
        </div>
        {hasContent && onCreateTrip && (
          <button
            type="button"
            onClick={onCreateTrip}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
          >
            <PlusCircle className="h-3.5 w-3.5" aria-hidden />
            {locale === 'vi' ? 'Tạo chuyến đi' : 'Create trip'}
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!hasContent && !loading && <EmptyCanvas locale={locale} />}

        {loading && !hasContent && (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {hasContent && (
          <>
            {bannerImage && (
              <div className="mb-5 overflow-hidden rounded-2xl">
                <img
                  src={bannerImage}
                  alt={destination || 'destination'}
                  className="h-40 w-full object-cover"
                  loading="lazy"
                />
              </div>
            )}
            <ol className="relative space-y-4">
              {/* connector line */}
              <span
                className="absolute bottom-4 left-2 top-4 w-px -translate-x-1/2 bg-gradient-to-b from-primary/60 via-border to-transparent"
                aria-hidden
              />
              <AnimatePresence initial={!reduce}>
                {days.map((d, i) => (
                  <DayCard key={d.day} day={d} index={i} locale={locale} />
                ))}
              </AnimatePresence>
            </ol>

            {citations.length > 0 && (
              <motion.div
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduce ? 0 : days.length * 0.12 + 0.1 }}
                className="mt-6 border-t border-border pt-4"
              >
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                  {locale === 'vi' ? 'Nguồn tham khảo' : 'Sources'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {citations.map((c, i) => (
                    <CitationChip key={c.id} citation={c} index={i} />
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function EmptyCanvas({ locale }: { locale: Locale }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-2 text-text-muted">
        <Map className="h-6 w-6" aria-hidden />
      </span>
      <p className="max-w-xs text-sm text-text-muted text-pretty">
        {locale === 'vi'
          ? 'Lịch trình của bạn sẽ hiện ở đây khi trợ lý dựng kế hoạch.'
          : 'Your itinerary will build here as the assistant plans your trip.'}
      </p>
    </div>
  );
}
