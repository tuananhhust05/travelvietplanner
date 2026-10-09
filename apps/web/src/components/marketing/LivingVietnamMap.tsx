'use client';

import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/cn';

interface Pin {
  name: string;
  cx: number;
  cy: number;
}

// Rough north→south ordering down the S-curve of Vietnam.
const PINS: readonly Pin[] = [
  { name: 'Hà Nội', cx: 118, cy: 92 },
  { name: 'Hạ Long', cx: 158, cy: 108 },
  { name: 'Huế', cx: 150, cy: 236 },
  { name: 'Đà Nẵng / Hội An', cx: 168, cy: 272 },
  { name: 'Đà Lạt', cx: 176, cy: 392 },
  { name: 'TP. Hồ Chí Minh', cx: 132, cy: 452 },
] as const;

// A loose S-curve silhouette suggesting Vietnam's landmass.
const COUNTRY_PATH =
  'M108 44 C150 60 150 104 132 128 C118 148 120 176 140 204 C168 240 172 268 158 300 ' +
  'C146 328 168 356 172 388 C176 420 150 452 122 476 C104 492 96 470 108 448 ' +
  'C124 416 118 388 100 360 C84 336 96 308 118 284 C140 260 132 232 112 208 ' +
  'C92 184 96 152 110 128 C122 108 90 92 88 68 C86 50 96 40 108 44 Z';

function arcBetween(a: Pin, b: Pin): string {
  const mx = (a.cx + b.cx) / 2;
  const my = (a.cy + b.cy) / 2;
  // Bow the control point outward (to the right of the coastline).
  const ctrlX = mx + 60;
  const ctrlY = my;
  return `M ${a.cx} ${a.cy} Q ${ctrlX} ${ctrlY} ${b.cx} ${b.cy}`;
}

export function LivingVietnamMap() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<number | null>(null);

  const container = {
    hidden: {},
    show: {
      transition: reduce ? {} : { staggerChildren: 0.14, delayChildren: 0.2 },
    },
  };

  const pinVariant = reduce
    ? { hidden: { opacity: 1, y: 0 }, show: { opacity: 1, y: 0 } }
    : {
        hidden: { opacity: 0, y: -28 },
        show: {
          opacity: 1,
          y: 0,
          transition: { type: 'spring' as const, stiffness: 420, damping: 22 },
        },
      };

  return (
    <div className="relative mx-auto w-full max-w-[440px] min-h-[200px]" aria-hidden={false}>
      <motion.svg
        viewBox="0 0 260 520"
        className="h-auto w-full overflow-visible"
        role="group"
        aria-label="Bản đồ điểm đến nổi bật của Việt Nam"
        variants={container}
        initial="hidden"
        animate="show"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
      >
        <defs>
          <linearGradient id="lvm-land" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#eab308" stopOpacity="0.14" />
          </linearGradient>
          <radialGradient id="lvm-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#eab308" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Landmass silhouette */}
        <path
          d={COUNTRY_PATH}
          fill="url(#lvm-land)"
          stroke="hsl(var(--primary))"
          strokeOpacity="0.5"
          strokeWidth="1.5"
        />

        {/* Arc route to the previous pin on hover/focus */}
        {active !== null && active > 0 && (
          <motion.path
            key={`arc-${active}`}
            d={arcBetween(PINS[active - 1], PINS[active])}
            fill="none"
            stroke="#eab308"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray="1 6"
            initial={reduce ? { pathLength: 1 } : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={reduce ? { duration: 0 } : { duration: 0.6, ease: [0, 0, 0.2, 1] }}
          />
        )}

        {/* Pins */}
        {PINS.map((pin, i) => {
          const isActive = active === i;
          return (
            <motion.g
              key={pin.name}
              variants={pinVariant}
              style={{ transformOrigin: `${pin.cx}px ${pin.cy}px` }}
              tabIndex={0}
              role="button"
              aria-label={`Điểm đến: ${pin.name}`}
              className="cursor-pointer outline-none focus-visible:[&_circle.hit]:stroke-ring"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive((prev) => (prev === i ? null : prev))}
              onFocus={() => setActive(i)}
              onBlur={() => setActive((prev) => (prev === i ? null : prev))}
            >
              {/* Pulsing glow ring */}
              <circle
                cx={pin.cx}
                cy={pin.cy}
                r="14"
                fill="url(#lvm-glow)"
                className={reduce ? '' : 'animate-pin-pulse'}
                style={{ transformOrigin: `${pin.cx}px ${pin.cy}px` }}
              />
              {/* Core dot */}
              <circle
                cx={pin.cx}
                cy={pin.cy}
                r={isActive ? 6 : 5}
                fill="#eab308"
                stroke="hsl(var(--bg))"
                strokeWidth="2"
              />
              {/* Enlarged transparent hit / focus target */}
              <circle
                cx={pin.cx}
                cy={pin.cy}
                r="16"
                fill="transparent"
                stroke="transparent"
                strokeWidth="2"
                className="hit"
              />
            </motion.g>
          );
        })}
      </motion.svg>

      {/* Hover / focus label as an accessible HTML overlay */}
      {active !== null && (
        <motion.div
          key={`label-${active}`}
          initial={reduce ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full',
            'rounded-full border border-white/10 bg-surface-1/80 px-3 py-1',
            'text-xs font-medium text-text shadow-e2 backdrop-blur-xl',
          )}
          style={{
            left: `${(PINS[active].cx / 260) * 100}%`,
            top: `${(PINS[active].cy / 520) * 100}%`,
          }}
        >
          {PINS[active].name}
        </motion.div>
      )}
    </div>
  );
}
