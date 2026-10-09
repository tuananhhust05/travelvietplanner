'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LocaleToggle } from '@/components/LocaleToggle';
import { Avatar } from '@/components/ui/avatar';
import { t, type Locale } from '@/lib/i18n';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { useAuth } from '@/lib/auth';

export function PublicNav({ locale = 'vi' }: { locale?: Locale }) {
  const [scrolled, setScrolled] = useState(false);
  const { user, isLoggedIn, loading } = useAuth();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const links: Array<[string, string]> = [
    ['/features', t(locale, 'nav.features')],
    ['/how-it-works', t(locale, 'nav.how')],
    ['/pricing', t(locale, 'nav.pricing')],
    ['/explore', t(locale, 'nav.explore')],
  ];

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-[background,border,backdrop-filter] duration-slow',
        scrolled
          ? 'backdrop-blur-xl bg-surface-1/70 border-b border-border'
          : 'bg-transparent border-b border-transparent',
      )}
    >
      <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 md:px-6">
        <BrandLogo href="/" />
        <div className="hidden items-center gap-5 md:flex">
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-text-muted transition-colors duration-base hover:text-text"
            >
              {label}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <LocaleToggle locale={locale} />
          <ThemeToggle />
          {loading ? (
            <div className="h-9 w-9 rounded-full bg-surface-2 animate-pulse" aria-hidden />
          ) : isLoggedIn ? (
            <Link href="/feed" className="flex items-center gap-2">
              <Avatar
                name={user?.displayName ?? 'Người dùng'}
                src={user?.avatarUrl}
                accountType={user?.activeProfileType ?? 'traveler'}
                size={36}
              />
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm">
                  {t(locale, 'nav.login')}
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">{t(locale, 'hero.cta')}</Button>
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
