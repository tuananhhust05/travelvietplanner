'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Check, User, Building2, Store, Compass, type LucideIcon } from 'lucide-react';
import { t, type Locale } from '@/lib/i18n';
import { cn } from '@/lib/cn';

export type AccountType = 'traveler' | 'agency' | 'business' | 'guide';

interface Option {
  value: AccountType;
  icon: LucideIcon;
  ring: string;
  iconColor: string;
}

const OPTIONS: Option[] = [
  { value: 'traveler', icon: User, ring: 'ring-primary', iconColor: 'text-primary' },
  { value: 'agency', icon: Building2, ring: 'ring-info', iconColor: 'text-info' },
  { value: 'business', icon: Store, ring: 'ring-accent', iconColor: 'text-accent' },
  { value: 'guide', icon: Compass, ring: 'ring-secondary', iconColor: 'text-secondary' },
];

export interface AccountTypeCardsProps {
  value: AccountType;
  onChange: (value: AccountType) => void;
  locale?: Locale;
  className?: string;
}

export function AccountTypeCards({
  value,
  onChange,
  locale = 'vi',
  className,
}: AccountTypeCardsProps) {
  const reduce = useReducedMotion();

  return (
    <div
      role="radiogroup"
      aria-label={t(locale, 'auth.accountType')}
      className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}
    >
      {OPTIONS.map(({ value: v, icon: Icon, ring, iconColor }) => {
        const selected = v === value;
        return (
          <motion.button
            key={v}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(v)}
            whileTap={reduce ? undefined : { scale: 0.98 }}
            animate={reduce ? undefined : { y: selected ? -4 : 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            className={cn(
              'relative flex flex-col items-start gap-2 rounded-2xl border p-4 text-left',
              'transition-colors duration-base ease-standard',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              selected
                ? cn('border-transparent bg-surface-2 ring-2 shadow-e2', ring)
                : 'border-border bg-surface-1 hover:bg-surface-2',
            )}
          >
            <span className="flex w-full items-center justify-between">
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl bg-surface-3',
                  iconColor,
                )}
              >
                <Icon size={20} aria-hidden />
              </span>
              {selected && (
                <motion.span
                  initial={reduce ? false : { scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-fg"
                >
                  <Check size={14} aria-hidden />
                </motion.span>
              )}
            </span>
            <span className="font-semibold text-text">{t(locale, `account.${v}`)}</span>
            <span className="text-sm text-text-muted text-pretty">
              {t(locale, `account.${v}.benefit`)}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
