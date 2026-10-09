'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n';
import { MeshBackground } from '@/components/effects/MeshBackground';

export function CTABand({ locale = 'vi' }: { locale?: Locale }) {
  const reduce = useReducedMotion();

  return (
    <section aria-label={t(locale, 'hero.cta')} className="px-4 py-16 md:px-6 md:py-24">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={reduce ? { duration: 0 } : { duration: 0.5, ease: [0, 0, 0.2, 1] }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-2xl border border-primary/30 p-8 shadow-glow sm:p-12"
      >
        {/* Lantern-warm mesh backdrop with an AA scrim */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(120% 140% at 15% 0%, rgba(16,185,129,0.28), transparent 55%),' +
              'radial-gradient(120% 140% at 90% 100%, rgba(234,179,8,0.22), transparent 55%),' +
              'hsl(var(--s1))',
          }}
        />
        <MeshBackground variant="gold" />
        <div className="relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl">
            <h2 className="text-balance text-3xl font-semibold tracking-tight text-text sm:text-4xl font-display italic">
              Bắt đầu từ một câu hỏi, về đến nhà với câu chuyện
            </h2>
            <p className="mt-3 text-pretty text-lg leading-relaxed text-text-muted">
              Miễn phí, không cần cài app. Trò chuyện với AI, dựng lịch trình
              theo ngày, rồi chia sẻ hành trình với cộng đồng du lịch Việt Nam.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                {t(locale, 'hero.cta')}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Link>
            <Link href="/planner">
              <Button size="lg" variant="outline">
                {t(locale, 'hero.tryPlanner')}
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
