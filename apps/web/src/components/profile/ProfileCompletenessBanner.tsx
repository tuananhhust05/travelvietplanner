'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserData {
  profileCompleteness?: number;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  interests?: string[];
  languages?: string[];
  website?: string;
  accountType?: 'traveler' | 'guide' | 'agency' | 'business';
}

export interface ProfileCompletenessBannerProps {
  /** 'dismissible' shows a close button and hides for 24 h after dismiss.
   *  'inline' always shows progress without dismiss (for the profile page). */
  variant?: 'dismissible' | 'inline';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DISMISS_KEY = 'tvp_banner_dismissed';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 h
const COMPLETENESS_THRESHOLD = 80;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMissingFields(user: UserData): string[] {
  const missing: string[] = [];
  if (!user.avatarUrl) missing.push('Ảnh đại diện');
  if (!user.bio) missing.push('Giới thiệu bản thân');
  if (!user.location) missing.push('Địa điểm');
  if (user.accountType === 'traveler' && (!user.interests || user.interests.length === 0)) {
    missing.push('Sở thích du lịch');
  }
  if (user.accountType === 'guide' && (!user.languages || user.languages.length === 0)) {
    missing.push('Ngôn ngữ hướng dẫn');
  }
  if (
    (user.accountType === 'agency' || user.accountType === 'business') &&
    !user.website
  ) {
    missing.push('Website');
  }
  return missing;
}

function isDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISS_KEY);
    if (!ts) return false;
    return Date.now() - Number(ts) < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProfileCompletenessBanner({
  variant = 'dismissible',
}: ProfileCompletenessBannerProps) {
  const [user, setUser] = useState<UserData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('tvp_user');
      if (!raw) return;

      const parsed: UserData = JSON.parse(raw);
      setUser(parsed);

      const completeness = parsed.profileCompleteness ?? 0;

      if (variant === 'inline') {
        // Inline variant always shows (no dismiss logic)
        setVisible(true);
        return;
      }

      // Dismissible: only show when below threshold and not recently dismissed
      if (completeness < COMPLETENESS_THRESHOLD && !isDismissed()) {
        setVisible(true);
      }
    } catch {
      // Silently ignore parse errors
    }
  }, [variant]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore storage errors
    }
    setVisible(false);
  };

  // Nothing to render
  if (!user || !visible) return null;

  const completeness = user.profileCompleteness ?? 0;

  // In dismissible mode, skip rendering if already complete
  if (variant === 'dismissible' && completeness >= COMPLETENESS_THRESHOLD) return null;

  const missingFields = getMissingFields(user);

  return (
    <AnimatePresence>
      <motion.div
        key="profile-completeness-banner"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
      >
        <Card className="border-primary/25 bg-primary/5 p-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-lg">🎯</span>
              <p className="text-sm font-semibold text-text">
                Hoàn thiện hồ sơ để được hiển thị nhiều hơn
              </p>
            </div>

            {variant === 'dismissible' && (
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Nhắc sau"
                className="flex-shrink-0 rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-2 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X size={16} aria-hidden />
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs text-text-muted">Hoàn thiện</span>
              <span className="text-xs font-semibold text-primary">{completeness}%</span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={completeness}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Hồ sơ hoàn thiện ${completeness}%`}
              className="h-2 w-full overflow-hidden rounded-full bg-primary/15"
            >
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${completeness}%` }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
              />
            </div>
          </div>

          {/* Missing fields */}
          {missingFields.length > 0 && (
            <p className="mt-2 text-xs text-text-muted">
              <span className="font-medium">Còn thiếu:</span>{' '}
              {missingFields.join(' · ')}
            </p>
          )}

          {/* Action row */}
          <div className="mt-3 flex items-center gap-3">
            <Link
              href="/settings/account"
              className="inline-flex h-8 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-semibold text-primary-fg transition-[background,filter] duration-base hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Cập nhật ngay →
            </Link>

            {variant === 'dismissible' && (
              <button
                type="button"
                onClick={handleDismiss}
                className="text-xs text-text-muted underline-offset-2 hover:text-text hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Nhắc sau
              </button>
            )}
          </div>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
