'use client';
import { useEffect, useRef } from 'react';

interface Props {
  variant?: 'jade' | 'gold' | 'dark';
  className?: string;
}

const COLORS: Record<string, [string, string, string]> = {
  jade: ['hsl(158 42% 35% / 0.15)', 'hsl(38 65% 52% / 0.10)', 'hsl(340 45% 65% / 0.07)'],
  gold: ['hsl(38 65% 52% / 0.18)', 'hsl(158 42% 35% / 0.10)', 'hsl(340 45% 65% / 0.08)'],
  dark: ['hsl(158 42% 35% / 0.22)', 'hsl(38 65% 52% / 0.12)', 'hsl(220 60% 40% / 0.10)'],
};

export function MeshBackground({ variant = 'jade', className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced motion — leave a static gradient instead
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const [c1, c2, c3] = COLORS[variant];
      el.style.backgroundImage = [
        `radial-gradient(ellipse 60% 50% at 50% 50%, ${c1}, transparent)`,
        `radial-gradient(ellipse 50% 60% at 30% 60%, ${c2}, transparent)`,
        `radial-gradient(ellipse 40% 40% at 70% 30%, ${c3}, transparent)`,
      ].join(', ');
      return;
    }

    const [c1, c2, c3] = COLORS[variant];
    let t = 0;
    let raf: number;

    const tick = () => {
      t += 0.003;
      const x1 = 50 + Math.sin(t) * 20;
      const y1 = 50 + Math.cos(t * 0.7) * 20;
      const x2 = 30 + Math.cos(t * 1.3) * 25;
      const y2 = 60 + Math.sin(t * 0.9) * 20;
      const x3 = 70 + Math.sin(t * 0.8) * 20;
      const y3 = 30 + Math.cos(t * 1.1) * 20;
      el.style.backgroundImage = [
        `radial-gradient(ellipse 60% 50% at ${x1.toFixed(1)}% ${y1.toFixed(1)}%, ${c1}, transparent)`,
        `radial-gradient(ellipse 50% 60% at ${x2.toFixed(1)}% ${y2.toFixed(1)}%, ${c2}, transparent)`,
        `radial-gradient(ellipse 40% 40% at ${x3.toFixed(1)}% ${y3.toFixed(1)}%, ${c3}, transparent)`,
      ].join(', ');
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [variant]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={`absolute inset-0 -z-10 ${className}`}
    />
  );
}
