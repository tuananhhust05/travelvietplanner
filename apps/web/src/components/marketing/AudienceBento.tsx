'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Compass, Building2, Hotel, Map, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { t, type Locale, type MessageKey } from '@/lib/i18n';

interface Audience {
  titleKey: MessageKey;
  benefitKey: MessageKey;
  href: string;
  icon: typeof Compass;
  tint: string;
  span: string;
}

const AUDIENCES: readonly Audience[] = [
  {
    titleKey: 'account.traveler',
    benefitKey: 'account.traveler.benefit',
    href: '/for-travelers',
    icon: Compass,
    tint: 'from-primary/25 to-primary/5',
    span: 'lg:col-span-3 lg:row-span-2',
  },
  {
    titleKey: 'account.agency',
    benefitKey: 'account.agency.benefit',
    href: '/for-agencies',
    icon: Building2,
    tint: 'from-info/25 to-info/5',
    span: 'lg:col-span-3',
  },
  {
    titleKey: 'account.guide',
    benefitKey: 'account.guide.benefit',
    href: '/for-guides',
    icon: Map,
    tint: 'from-secondary/25 to-secondary/5',
    span: 'lg:col-span-2',
  },
  {
    titleKey: 'account.business',
    benefitKey: 'account.business.benefit',
    href: '/for-businesses',
    icon: Hotel,
    tint: 'from-accent/25 to-accent/5',
    span: 'lg:col-span-1',
  },
] as const;

export function AudienceBento({ locale = 'vi' }: { locale?: Locale }) {
  const reduce = useReducedMotion();

  return (
    <section
      aria-label="Đối tượng sử dụng"
      className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24"
    >
      <div className="mb-10 max-w-lg">
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t(locale, 'footer.audiences')}
        </span>
        <h2 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-text sm:text-4xl">
          Dù bạn đang đi chơi, làm tour hay đón khách
        </h2>
      </div>

      <div className="grid auto-rows-[minmax(9rem,auto)] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        {AUDIENCES.map((a, i) => {
          const Icon = a.icon;
          return (
            <motion.div
              key={a.href}
              initial={reduce ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={
                reduce
                  ? { duration: 0 }
                  : { duration: 0.45, delay: i * 0.06, ease: [0, 0, 0.2, 1] }
              }
              className={cn('group', a.span)}
            >
              <Link
                href={a.href}
                className={cn(
                  'relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-surface-1 p-5',
                  'shadow-e2 transition-transform duration-base ease-standard hover:-translate-y-1',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                )}
              >
                <div
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-slow group-hover:opacity-100',
                    a.tint,
                  )}
                />
                <div className="relative flex items-start justify-between">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-2 text-text">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <ArrowUpRight
                    className="h-5 w-5 text-text-muted transition-transform duration-base group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </div>
                <h3 className="relative mt-4 text-xl font-semibold text-text">
                  {t(locale, a.titleKey)}
                </h3>
                <p className="relative mt-2 text-pretty text-sm leading-relaxed text-text-muted">
                  {t(locale, a.benefitKey)}
                </p>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
