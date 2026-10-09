'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { MapPin, Wallet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { Locale } from '@/lib/i18n';

export interface ItineraryStop {
  name: string;
  note?: string;
}

export interface ItineraryDay {
  day: number;
  title: string;
  stops: ItineraryStop[];
  budget: string;
}

export function DayCard({
  day,
  index,
  locale,
}: {
  day: ItineraryDay;
  index: number;
  locale: Locale;
}) {
  const reduce = useReducedMotion();
  const dayLabel = locale === 'vi' ? 'Ngày' : 'Day';

  return (
    <motion.li
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.97 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={
        reduce
          ? { duration: 0.15 }
          : { type: 'spring', stiffness: 260, damping: 24, delay: index * 0.12 }
      }
      className="relative pl-10"
    >
      {/* timeline node */}
      <span
        className="absolute left-2 top-5 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-fg shadow-glow"
        aria-hidden
      >
        {day.day}
      </span>

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">
              {dayLabel} {day.day}
            </p>
            <h3 className="text-base font-semibold text-text text-balance">{day.title}</h3>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
            <Wallet className="h-3 w-3" aria-hidden />
            {day.budget}
          </span>
        </div>

        <ul className="mt-3 space-y-2">
          {day.stops.map((stop, i) => (
            <li key={i} className="flex gap-2 text-sm text-text">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-text-muted" aria-hidden />
              <span>
                <span className="font-medium">{stop.name}</span>
                {stop.note && (
                  <span className="block text-xs text-text-muted text-pretty">{stop.note}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </motion.li>
  );
}
