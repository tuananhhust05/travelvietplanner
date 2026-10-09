'use client';

import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/i18n';

export function LocaleToggle({ locale }: { locale: Locale }) {
  const router = useRouter();
  const pathname = usePathname();

  function setLocale(next: Locale) {
    if (next === locale) return;
    const sp = new URLSearchParams(
      typeof window !== 'undefined' ? window.location.search : '',
    );
    sp.set('lang', next);
    document.cookie = `tvp_lang=${next}; path=/; max-age=31536000`;
    router.push(`${pathname}?${sp.toString()}`);
  }

  return (
    <div
      role="radiogroup"
      aria-label="Language"
      className="inline-flex items-center rounded-full border border-border bg-surface-2 p-0.5 text-xs font-semibold"
    >
      {(['vi', 'en'] as const).map((l) => (
        <button
          key={l}
          role="radio"
          aria-checked={locale === l}
          onClick={() => setLocale(l)}
          className={cn(
            'rounded-full px-2.5 py-1 uppercase transition-colors duration-base',
            locale === l ? 'bg-primary text-primary-fg' : 'text-text-muted hover:text-text',
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
