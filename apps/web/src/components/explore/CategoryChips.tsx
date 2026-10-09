'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';

export interface CategoryChipsProps {
  categories: readonly string[];
  active: string;
  onChange: (category: string) => void;
  className?: string;
}

export function CategoryChips({ categories, active, onChange, className }: CategoryChipsProps) {
  const reduce = useReducedMotion();

  return (
    <div
      role="radiogroup"
      aria-label="Lọc điểm đến theo chủ đề"
      className={cn(
        'sticky top-[60px] z-30 -mx-4 flex gap-2 overflow-x-auto px-4 py-3 md:-mx-6 md:px-6',
        'backdrop-blur-xl bg-bg/80 border-b border-border',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {categories.map((cat) => {
        const selected = cat === active;
        return (
          <button
            key={cat}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-pressed={selected}
            onClick={() => onChange(cat)}
            className={cn(
              'relative shrink-0 rounded-full px-4 py-1.5 text-sm font-medium',
              'transition-colors duration-base ease-standard',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              selected ? 'text-primary-fg' : 'text-text-muted hover:text-text',
            )}
          >
            {selected && (
              <motion.span
                layoutId="chip-active"
                aria-hidden
                className="absolute inset-0 rounded-full bg-primary shadow-glow"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 480, damping: 34 }
                }
              />
            )}
            <span className="relative z-10">{cat}</span>
          </button>
        );
      })}
    </div>
  );
}
