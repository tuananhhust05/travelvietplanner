'use client';

import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n';
import { MeshBackground } from '@/components/effects/MeshBackground';
import { EarthGlobe } from '@/components/effects/EarthGlobe';

export function Hero({ locale = 'vi' }: { locale?: Locale }) {
  const reduce = useReducedMotion();

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: [0, 0, 0.2, 1] as const },
        };

  return (
    <section
      aria-label={t(locale, 'hero.title')}
      className="relative isolate overflow-hidden"
    >
      <MeshBackground variant="jade" />

      {/* Floating map-pin dots */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {(
          [
            { top: '15%', left: '10%', h: 'h-1.5', w: 'w-1.5', opacity: 'opacity-40', delay: '0s' },
            { top: '25%', left: '85%', h: 'h-2',   w: 'w-2',   opacity: 'opacity-30', delay: '0.4s' },
            { top: '60%', left: '5%',  h: 'h-1',   w: 'w-1',   opacity: 'opacity-50', delay: '0.8s' },
            { top: '70%', left: '90%', h: 'h-1.5', w: 'w-1.5', opacity: 'opacity-35', delay: '1.2s' },
            { top: '40%', left: '75%', h: 'h-2',   w: 'w-2',   opacity: 'opacity-45', delay: '0.6s' },
            { top: '80%', left: '30%', h: 'h-1',   w: 'w-1',   opacity: 'opacity-30', delay: '1.0s' },
            { top: '10%', left: '60%', h: 'h-1.5', w: 'w-1.5', opacity: 'opacity-40', delay: '0.2s' },
            { top: '55%', left: '50%', h: 'h-1',   w: 'w-1',   opacity: 'opacity-35', delay: '1.4s' },
          ] as const
        ).map((dot, i) => (
          <span
            key={i}
            className={`absolute ${dot.h} ${dot.w} ${dot.opacity} rounded-full bg-primary animate-pin-pulse`}
            style={{ top: dot.top, left: dot.left, animationDelay: dot.delay }}
          />
        ))}
      </div>
      {/* Animated lantern-warm gradient mesh */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute -left-32 -top-32 h-[36rem] w-[36rem] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(closest-side, rgba(16,185,129,0.28), transparent)',
          }}
          animate={reduce ? undefined : { x: [0, 40, 0], y: [0, 30, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-24 top-10 h-[32rem] w-[32rem] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(closest-side, rgba(234,179,8,0.22), transparent)',
          }}
          animate={reduce ? undefined : { x: [0, -30, 0], y: [0, 40, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full blur-3xl"
          style={{
            background:
              'radial-gradient(closest-side, rgba(244,114,182,0.16), transparent)',
          }}
          animate={reduce ? undefined : { x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-[1.1fr_0.9fr] md:gap-6 md:px-6 md:py-28 lg:py-32">
        {/* Copy column */}
        <div className="max-w-2xl">
          <motion.span
            {...rise(0)}
            className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            {t(locale, 'app.tagline')}
          </motion.span>

          <motion.h1
            {...rise(0.08)}
            className="mt-5 text-balance text-4xl font-bold leading-[1.05] tracking-tight text-text sm:text-5xl lg:text-6xl font-display italic"
          >
            {t(locale, 'hero.title')}
          </motion.h1>

          <motion.p
            {...rise(0.16)}
            className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-text-muted"
          >
            {t(locale, 'hero.sub')}
          </motion.p>

          <motion.div {...rise(0.24)} className="mt-8 flex flex-wrap gap-3">
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
          </motion.div>
        </div>

        {/* Centerpiece: 3D Earth Globe */}
        <div className="relative hidden sm:block h-[400px] md:h-[480px] lg:h-[540px]">
          <EarthGlobe className="absolute inset-0" />
        </div>
      </div>
    </section>
  );
}
