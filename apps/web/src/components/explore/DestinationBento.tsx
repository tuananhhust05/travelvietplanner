'use client';

import { useRef, type PointerEvent } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/cn';

export interface Destination {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  region: string;
  category: string;
  gradient: string;
  span: string;
}

const MAX_TILT = 8;

function TiltCard({ dest, reduce }: { dest: Destination; reduce: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const srx = useSpring(rx, { stiffness: 260, damping: 22 });
  const sry = useSpring(ry, { stiffness: 260, damping: 22 });
  const rotateX = useTransform(srx, (v) => `${v}deg`);
  const rotateY = useTransform(sry, (v) => `${v}deg`);

  function onMove(e: PointerEvent<HTMLAnchorElement>) {
    if (reduce || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    rx.set((0.5 - py) * MAX_TILT * 2);
    ry.set((px - 0.5) * MAX_TILT * 2);
    ref.current.style.setProperty('--x', `${px * 100}%`);
    ref.current.style.setProperty('--y', `${py * 100}%`);
  }

  function onLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.a
      ref={ref}
      href={`/places/${dest.slug}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      style={reduce ? undefined : { rotateX, rotateY, transformPerspective: 900 }}
      className={cn(
        'group relative flex flex-col justify-end overflow-hidden rounded-2xl border border-border p-4',
        'shadow-e2 transition-shadow duration-base hover:shadow-e3',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        !reduce && 'spotlight',
        'min-h-[180px]',
        dest.span,
      )}
    >
      <span
        aria-hidden
        className={cn('absolute inset-0 -z-10 bg-gradient-to-br', dest.gradient)}
      />
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/20 to-transparent"
      />
      <Badge tone="primary" className="mb-2 w-fit bg-black/40 text-white backdrop-blur-sm">
        {dest.region}
      </Badge>
      <h3 className="text-lg font-semibold text-white text-balance">{dest.name}</h3>
      <p className="mt-1 text-sm text-white/80 text-pretty">{dest.blurb}</p>
    </motion.a>
  );
}

export interface DestinationBentoProps {
  destinations: Destination[];
  loading?: boolean;
  className?: string;
}

const GRID = 'grid grid-cols-1 gap-4 md:grid-cols-4 [grid-auto-rows:180px]';
const SKELETON_SPANS = [
  'md:col-span-2 md:row-span-2',
  'md:col-span-2 md:row-span-1',
  'md:col-span-1 md:row-span-1',
  'md:col-span-1 md:row-span-2',
  'md:col-span-2 md:row-span-1',
  'md:col-span-1 md:row-span-1',
];

export function DestinationBento({ destinations, loading, className }: DestinationBentoProps) {
  const reduce = useReducedMotion() ?? false;

  if (loading) {
    return (
      <div className={cn(GRID, className)} aria-busy="true" aria-label="Đang tải điểm đến">
        {SKELETON_SPANS.map((span, i) => (
          <Skeleton key={i} className={cn('rounded-2xl', span)} />
        ))}
      </div>
    );
  }

  return (
    <div className={cn(GRID, className)}>
      {destinations.map((dest) => (
        <TiltCard key={dest.id} dest={dest} reduce={reduce} />
      ))}
    </div>
  );
}
