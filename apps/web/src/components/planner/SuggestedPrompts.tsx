'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { Locale } from '@/lib/i18n';
import { cn } from '@/lib/cn';

export interface SuggestedPrompt {
  vi: string;
  en: string;
}

const PROMPTS: SuggestedPrompt[] = [
  { vi: 'Mình có 5 ngày, xuất phát từ Hà Nội, muốn thấy núi', en: '5 days from Hanoi, want mountains' },
  { vi: 'Ăn gì ngon ở Hội An ngoài cao lầu', en: 'Best food in Hội An beyond cao lầu' },
  { vi: 'Hà Giang loop 3 ngày, đi xe máy lần đầu', en: 'Hà Giang loop 3 days, first-time rider' },
  { vi: 'Đà Lạt 2 ngày cuối tuần không đụng hàng', en: 'Đà Lạt weekend off the beaten path' },
  { vi: 'Hang động Phong Nha nên đặt tour nào', en: 'Which Phong Nha cave tour to book' },
];

export function SuggestedPrompts({
  locale,
  disabled,
  onPick,
}: {
  locale: Locale;
  disabled?: boolean;
  onPick: (prompt: string) => void;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-text-muted">
        <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
        {locale === 'vi' ? 'Gợi ý' : 'Try'}
      </span>
      {PROMPTS.map((p, i) => {
        const label = locale === 'vi' ? p.vi : p.en;
        return (
          <motion.button
            key={p.en}
            type="button"
            disabled={disabled}
            onClick={() => onPick(label)}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: reduce ? 0 : i * 0.04, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              'rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-text',
              'transition-[background,border,transform] duration-fast ease-standard',
              'hover:border-primary/40 hover:bg-surface-3 active:scale-[0.97]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:opacity-50 disabled:pointer-events-none',
            )}
          >
            {label}
          </motion.button>
        );
      })}
    </div>
  );
}
