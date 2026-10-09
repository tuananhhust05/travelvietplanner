'use client';

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bell,
  Briefcase,
  CalendarCheck,
  Compass,
  Home,
  LayoutDashboard,
  LayoutList,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { t, type Locale, useLocale } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';
import { useNotificationBadge } from '@/hooks/useNotifications';
import { BrandLogo } from '@/components/layout/BrandLogo';
import { ProfileMenu } from '@/components/layout/ProfileMenu';

const PUBLIC_NAV = (locale: Locale) =>
  [
    { href: '/feed', label: t(locale, 'nav.feed'), icon: Home },
    { href: '/explore', label: t(locale, 'nav.explore'), icon: Compass },
  ] as const;

// The planner is the landing page for signed-in users, so it leads the nav for
// every profile type instead of sitting inside one type's list.
const PLANNER_NAV = (locale: Locale): NavItem => ({
  href: '/planner',
  label: t(locale, 'nav.planner'),
  icon: Sparkles,
});

const AUTH_NAV_BY_TYPE = (locale: Locale): Record<string, NavItem[]> => ({
  traveler: [
    { href: '/traveler/dashboard', label: t(locale, 'nav.dashboard'), icon: LayoutDashboard },
    { href: '/messages', label: t(locale, 'nav.messages'), icon: MessageCircle },
    { href: '/profile/me', label: t(locale, 'nav.profile'), icon: User },
  ],
  guide: [
    { href: '/guide/dashboard', label: t(locale, 'nav.dashboard'), icon: LayoutDashboard },
    { href: '/bookings', label: t(locale, 'nav.bookings'), icon: CalendarCheck },
    { href: '/services', label: t(locale, 'nav.services'), icon: Briefcase },
    { href: '/messages', label: t(locale, 'nav.messages'), icon: MessageCircle },
    { href: '/profile/me', label: t(locale, 'nav.profile'), icon: User },
  ],
  agency: [
    { href: '/agency/dashboard', label: t(locale, 'nav.dashboard'), icon: LayoutDashboard },
    { href: '/listings', label: t(locale, 'nav.listings'), icon: LayoutList },
    { href: '/messages', label: t(locale, 'nav.messages'), icon: MessageCircle },
    { href: '/profile/me', label: t(locale, 'nav.profile'), icon: User },
  ],
  business: [
    { href: '/business/dashboard', label: t(locale, 'nav.dashboard'), icon: LayoutDashboard },
    { href: '/listings', label: t(locale, 'nav.listings'), icon: LayoutList },
    { href: '/messages', label: t(locale, 'nav.messages'), icon: MessageCircle },
    { href: '/profile/me', label: t(locale, 'nav.profile'), icon: User },
  ],
});

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

function NavLink({ href, label, icon: Icon, pathname }: NavItem & { pathname: string }) {
  const active = pathname === href || pathname.startsWith(href + '/');
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-base',
        active
          ? 'bg-primary/15 text-primary'
          : 'text-text-muted hover:bg-surface-2 hover:text-text',
      )}
    >
      <Icon size={20} className="shrink-0" />
      <span className="hidden xl:inline">{label}</span>
    </Link>
  );
}

export function AppShell({
  children,
  flush = false,
}: {
  children: React.ReactNode;
  /** Full-height pages (e.g. chat) fill the viewport below the header with no page scroll. */
  flush?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchValue, setSearchValue] = useState('');
  const searchRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [suggestions, setSuggestions] = useState<Array<{ _id: string; slug: string; name: string; province: string }>>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);

  useEffect(() => {
    const q = searchValue.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    const timer = setTimeout(async () => {
      setSuggestLoading(true);
      try {
        const res = await fetch(`/api/v1/search/places?q=${encodeURIComponent(q)}&limit=5`);
        if (res.ok) {
          const data = await res.json() as { items: Array<{ _id: string; slug: string; name: string; province: string }> };
          setSuggestions(data.items ?? []);
        }
      } catch { setSuggestions([]); }
      finally { setSuggestLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchValue]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { user, isLoggedIn, loading } = useAuth();
  // Badge only — deliberately NOT the full list hook: AppShell renders on every
  // page, and fetching a page of rows plus their actor hydration to render one
  // number would cost a request per navigation.
  const unreadNotifications = useNotificationBadge(isLoggedIn && !loading);
  const locale = useLocale();

  const publicItems = PUBLIC_NAV(locale) as unknown as NavItem[];

  const authItems = isLoggedIn
    ? [
        PLANNER_NAV(locale),
        ...(AUTH_NAV_BY_TYPE(locale)[user?.activeProfileType ?? 'traveler'] ?? AUTH_NAV_BY_TYPE(locale).traveler),
      ]
    : [];
  // Signed in, the planner leads the rail; the public feed/explore follow it.
  const railItems: NavItem[] = isLoggedIn ? [...authItems, ...publicItems] : publicItems;
  const mobileItems: NavItem[] = railItems;

  return (
    <div className={cn(flush ? 'h-dvh overflow-hidden bg-bg' : 'min-h-screen bg-bg')}>
      {/* Top bar */}
      {/* h-16 belongs on the header itself, not the inner row: border-box keeps the
          1px border-b inside the 4rem that `flush` panes subtract below. With the
          height on the child instead, the border sat outside it and the shell
          overflowed the viewport by exactly one pixel. */}
      <header className="sticky top-0 z-40 h-16 backdrop-blur-xl bg-surface-1/70 border-b border-border">
        <div className="mx-auto flex h-full max-w-6xl items-center gap-3 px-4 md:px-6">
          <BrandLogo />

          <div className="relative ml-4 hidden flex-1 md:block" ref={searchRef}>
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted z-10"
            />
            <input
              aria-label="Search"
              placeholder={t(locale, 'nav.search')}
              className="w-full rounded-full border border-border bg-surface-2 py-2 pl-9 pr-4 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={searchValue}
              onChange={(e) => { setSearchValue(e.target.value); setShowDropdown(true); }}
              onFocus={() => { if (searchValue.trim()) setShowDropdown(true); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchValue.trim()) {
                  setShowDropdown(false);
                  router.push('/search?q=' + encodeURIComponent(searchValue.trim()) + '&tab=all');
                }
                if (e.key === 'Escape') setShowDropdown(false);
              }}
            />
            {/* Dropdown */}
            {showDropdown && searchValue.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-full mt-1 overflow-hidden rounded-xl border border-border bg-surface-1 shadow-e3 z-50">
                {suggestLoading ? (
                  <div className="px-4 py-3 text-sm text-text-muted">Đang tìm...</div>
                ) : suggestions.length > 0 ? (
                  <ul>
                    {suggestions.map((place) => (
                      <li key={place._id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-surface-2 transition-colors"
                          onClick={() => {
                            setShowDropdown(false);
                            setSearchValue('');
                            router.push(`/places/${place.slug}`);
                          }}
                        >
                          <MapPin size={15} className="shrink-0 text-primary" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-text">{place.name}</p>
                            {place.province && (
                              <p className="truncate text-xs text-text-muted">{place.province}</p>
                            )}
                          </div>
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 border-t border-border px-4 py-2.5 text-sm text-primary hover:bg-surface-2 transition-colors"
                        onClick={() => {
                          setShowDropdown(false);
                          router.push('/search?q=' + encodeURIComponent(searchValue.trim()) + '&tab=all');
                        }}
                      >
                        <Search size={14} />
                        Xem tất cả kết quả cho &quot;{searchValue}&quot;
                      </button>
                    </li>
                  </ul>
                ) : (
                  <div className="px-4 py-3 text-sm text-text-muted">Không tìm thấy địa điểm</div>
                )}
              </div>
            )}
          </div>

          <div className="ml-auto flex min-w-0 items-center gap-1 sm:gap-2">
            {!loading && isLoggedIn && (
              <>
                <Link
                  href="/create"
                  aria-label={t(locale, 'common.create')}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-fg hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Plus size={18} />
                </Link>
                <Link
                  href="/notifications"
                  // The count belongs in the accessible name, not only in the
                  // badge: a screen reader gets nothing from a styled span.
                  aria-label={
                    unreadNotifications > 0
                      ? `${t(locale, 'common.notifications')} (${unreadNotifications})`
                      : t(locale, 'common.notifications')
                  }
                  className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface-2 text-text hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Bell size={18} />
                  {unreadNotifications > 0 && (
                    <span
                      aria-hidden
                      className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold leading-none text-white"
                    >
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </Link>
              </>
            )}

            <ThemeToggle />

            {loading ? (
              <div className="h-10 w-10 rounded-full bg-surface-2 animate-pulse" aria-hidden />
            ) : isLoggedIn ? (
              <ProfileMenu />
            ) : (
              <div className="flex items-center gap-1.5">
                <Link href="/login">
                  <Button size="sm" variant="ghost">
                    {t(locale, 'nav.login')}
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">{t(locale, 'nav.register')}</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-4 md:px-6">
        {/* Left rail */}
        <nav
          aria-label="Main navigation"
          className="sticky top-[64px] hidden h-[calc(100vh-64px)] w-16 shrink-0 flex-col gap-1 py-6 lg:flex xl:w-56"
        >
          {railItems.map((item) => (
            <NavLink key={item.href} {...item} pathname={pathname} />
          ))}

          {!isLoggedIn && (
            <div className="mt-3 hidden rounded-xl border border-border bg-surface-2 px-3 py-3 xl:block">
              <p className="text-xs leading-relaxed text-text-muted">
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                >
                  {t(locale, 'nav.login')}
                </Link>{' '}
                {t(locale, 'auth.loginToSeeMore')}
              </p>
            </div>
          )}
        </nav>

        <main
          className={cn(
            'min-w-0 flex-1',
            flush
              // dvh (not vh) so the mobile URL bar collapsing doesn't resize the
              // pane mid-scroll. The bottom nav only exists below lg, so its
              // 3.5rem is subtracted there and reclaimed on desktop.
              ? 'h-[calc(100dvh-4rem-3.5rem)] overflow-hidden lg:h-[calc(100dvh-4rem)]'
              : 'py-6 pb-24 lg:pb-6',
          )}
        >
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Mobile navigation"
        // h-14 locks the bar to the 3.5rem that `flush` panes subtract above.
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t border-border bg-surface-1/90 backdrop-blur-xl lg:hidden"
      >
        {mobileItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              aria-label={label}
              className={cn(
                'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px]',
                active ? 'text-primary' : 'text-text-muted',
              )}
            >
              <Icon size={22} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
