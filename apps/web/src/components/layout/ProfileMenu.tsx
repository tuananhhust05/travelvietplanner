'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Check, Compass, Home, LayoutDashboard, LogOut, MessageCircle, Settings, User } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Avatar } from '@/components/ui/avatar';
import { t, useLocale } from '@/lib/i18n';
import { useAuth, type AuthUser } from '@/lib/auth';
import { useAnchoredMenu } from '@/hooks/useAnchoredMenu';
import { AddProfileModal } from '@/components/auth/AddProfileModal';

type ProfileType = AuthUser['activeProfileType'];

const BADGE_LABELS: Record<ProfileType, string> = {
  traveler: 'Traveler',
  agency: 'Agency',
  business: 'Business',
  guide: 'Guide',
};

const BADGE_CLASSES: Record<ProfileType, string> = {
  traveler: 'bg-primary/15 text-primary',
  agency: 'bg-info/15 text-info',
  business: 'bg-info/15 text-info',
  guide: 'bg-secondary/15 text-secondary',
};

export function ProfileMenu() {
  const menu = useAnchoredMenu({ align: 'end', gap: 8, minWidth: 256 });
  const { user, logout, switchProfile, addProfile } = useAuth();
  const [addProfileOpen, setAddProfileOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | null>(null);
  const locale = useLocale();

  if (!user) return null;

  const displayName = user?.displayName ?? t(locale, 'common.defaultUser');
  const handle = user?.handle ?? null;
  const activeProfileType = user?.activeProfileType ?? 'traveler';
  const profiles = user?.profiles ?? [];
  const completeness = user?.profileCompleteness ?? 0;

  return (
    <div className="relative">
      <button
        ref={menu.triggerRef}
        type="button"
        onClick={menu.toggle}
        aria-label={t(locale, 'common.account')}
        aria-expanded={menu.open}
        aria-haspopup="menu"
        className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Avatar
          name={displayName}
          src={user?.avatarUrl}
          accountType={activeProfileType}
          size={40}
        />
      </button>

      {menu.mounted && menu.open && createPortal(
        <div
          ref={menu.menuRef}
          role="menu"
          style={menu.style}
          className="w-64 overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-1 shadow-e3"
        >
          {/* User identity header */}
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Avatar
              name={displayName}
              src={user?.avatarUrl}
              accountType={activeProfileType}
              size={44}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-sm text-text leading-tight">
                {displayName}
              </p>
              {handle && (
                <p className="truncate text-xs text-text-muted leading-tight mt-0.5">
                  @{handle}
                </p>
              )}
              <span
                className={cn(
                  'mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold leading-none',
                  BADGE_CLASSES[activeProfileType as keyof typeof BADGE_CLASSES],
                )}
              >
                {BADGE_LABELS[activeProfileType as keyof typeof BADGE_LABELS]}
              </span>
            </div>
          </div>

          {/* Profile completeness */}
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-text-muted">{t(locale, 'common.completeProfile')}</span>
              <span className="text-xs font-semibold text-text">{completeness}%</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
              role="progressbar"
              aria-valuenow={completeness}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${t(locale, 'common.completeProfile')} ${completeness}%`}
            >
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${completeness}%` }}
              />
            </div>
            {completeness < 100 && (
              <Link
                href="/profile/me?edit=1"
                role="menuitem"
                onClick={() => menu.close()}
                className="mt-1.5 block text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              >
                {t(locale, 'common.completeProfileArrow')}
              </Link>
            )}
          </div>

          {/* Profiles section */}
          <div className="border-t border-border py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {t(locale, 'common.profiles')}
            </p>
            {profiles.map((profile) => {
              const isActive = profile.type === activeProfileType
              return (
                <button
                  key={profile.type}
                  type="button"
                  role="menuitem"
                  disabled={isActive || switchingTo !== null}
                  onClick={async () => {
                    if (isActive) return
                    menu.close()
                    setSwitchingTo(profile.type)
                    try {
                      await switchProfile(profile.type as any)
                      window.location.href = `/${profile.type}/dashboard`
                    } finally {
                      setSwitchingTo(null)
                    }
                  }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-text hover:bg-surface-2 disabled:opacity-60"
                >
                  <span className={cn('flex h-4 w-4 items-center justify-center rounded-full border', isActive ? 'border-primary bg-primary' : 'border-border bg-transparent')}>
                    {isActive && <Check size={10} className="text-primary-fg" />}
                  </span>
                  <span className="flex-1 text-left">
                    {BADGE_LABELS[profile.type as keyof typeof BADGE_LABELS]}
                  </span>
                  <span className="text-xs text-text-muted">{profile.profileCompleteness}%</span>
                </button>
              )
            })}
            <button
              type="button"
              role="menuitem"
              onClick={() => { menu.close(); setAddProfileOpen(true) }}
              className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-primary hover:bg-surface-2"
            >
              <span className="flex h-4 w-4 items-center justify-center text-primary">+</span>
              {t(locale, 'common.addProfile')}
            </button>
          </div>

          {/* Navigation shortcuts */}
          <div className="border-t border-border py-1">
            <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Điều hướng
            </p>
            <Link
              href={`/${user.activeProfileType}/dashboard`}
              role="menuitem"
              onClick={() => menu.close()}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface-2"
            >
              <LayoutDashboard size={15} aria-hidden />
              {t(locale, 'nav.dashboard')}
            </Link>
            <Link
              href="/feed"
              role="menuitem"
              onClick={() => menu.close()}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface-2"
            >
              <Home size={15} aria-hidden />
              {t(locale, 'nav.feed')}
            </Link>
            <Link
              href="/messages"
              role="menuitem"
              onClick={() => menu.close()}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface-2"
            >
              <MessageCircle size={15} aria-hidden />
              {t(locale, 'nav.messages')}
            </Link>
            <Link
              href="/explore"
              role="menuitem"
              onClick={() => menu.close()}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface-2"
            >
              <Compass size={15} aria-hidden />
              {t(locale, 'nav.explore')}
            </Link>
          </div>

          {/* Account items */}
          <div className="border-t border-border py-1">
            <Link
              href="/profile/me"
              role="menuitem"
              onClick={() => menu.close()}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface-2"
            >
              <User size={15} aria-hidden />
              {t(locale, 'common.myProfile')}
            </Link>
            <Link
              href="/settings/account"
              role="menuitem"
              onClick={() => menu.close()}
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface-2"
            >
              <Settings size={15} aria-hidden />
              {t(locale, 'common.settings')}
            </Link>
          </div>

          <div className="border-t border-border py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => { menu.close(); logout(); }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-danger hover:bg-surface-2"
            >
              <LogOut size={15} aria-hidden />
              {t(locale, 'common.logout')}
            </button>
          </div>
        </div>,
        document.body,
      )}

      <AddProfileModal
        open={addProfileOpen}
        onClose={() => setAddProfileOpen(false)}
        existingTypes={profiles.map(p => p.type)}
        onAdd={async (profileType, displayName) => {
          await addProfile(profileType, displayName)
        }}
      />
    </div>
  );
}