'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';

export function BrandLogo({ className, href = '/feed' }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      aria-label="TravelVietPlaner — trang chủ"
      className={cn(
        'group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg',
        className,
      )}
    >
      {/* TVP badge — calligraphic SVG letterform */}
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/30 transition-all duration-200 group-hover:shadow-primary/45 group-hover:scale-105">
        <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/25 via-transparent to-black/15" />
        <svg
          viewBox="0 0 36 36"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative w-[28px] h-[28px]"
          aria-hidden="true"
        >
          {/* T — crossbar y=12, stem down to y=27 */}
          <line x1="3.5" y1="12" x2="13" y2="12" stroke="white" strokeWidth="2.8" strokeLinecap="round"/>
          <path d="M8.2 12 Q7.8 19 8.2 27" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
          <line x1="6" y1="27" x2="10.5" y2="27" stroke="#c8973a" strokeWidth="1.6" strokeLinecap="round"/>
          {/* V — top y=12, apex y=27 */}
          <path d="M14.5 12 L18 27" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M21.5 12 L18 27" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
          <circle cx="18" cy="27" r="1.4" fill="#c8973a"/>
          {/* P — stem y=12..27, bowl y=12..20 */}
          <path d="M24 12 L24 27" stroke="white" strokeWidth="2.2" strokeLinecap="round"/>
          <path d="M24 12 Q31.5 12 31.5 16.5 Q31.5 21 24 20.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          <line x1="22" y1="27" x2="26" y2="27" stroke="#c8973a" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </span>

      {/* Wordmark — Playfair serif italic + sans tagline */}
      <span className="flex flex-col leading-none select-none" style={{ marginTop: '-3px' }}>
        <span
          className="italic font-black text-text"
          style={{
            fontFamily: 'var(--font-playfair), Georgia, serif',
            fontSize: '18px',
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          Travel<span className="text-primary">Viet</span>
        </span>
        <span
          className="font-semibold uppercase tracking-[0.2em] text-text-muted"
          style={{ fontSize: '9px', letterSpacing: '0.2em', marginTop: '2px' }}
        >
          Planer
        </span>
      </span>
    </Link>
  );
}
