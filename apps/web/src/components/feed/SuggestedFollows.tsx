'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { api } from '@/lib/api';
import { t, type Locale } from '@/lib/i18n';
import type { AccountType } from '@/components/feed/PostCard';

interface Suggestion {
  _id: string;
  displayName: string;
  handle?: string;
  avatarUrl?: string;
  accountType?: AccountType;
  postCount?: number;
}

export function SuggestedFollows({ locale = 'vi' }: { locale?: Locale }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [following, setFollowing] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .suggestions(12)
      .then((data) => {
        if (!active) return;
        setSuggestions((data.items as Suggestion[]) ?? []);
      })
      .catch(() => {
        // non-blocking — hide the rail on failure
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function toggle(s: Suggestion) {
    const isFollowing = !!following[s._id];
    // optimistic update
    setFollowing((prev) => ({ ...prev, [s._id]: !isFollowing }));
    try {
      if (isFollowing) {
        await api.unfollow(s._id);
      } else {
        await api.follow(s._id);
      }
    } catch {
      // revert on failure
      setFollowing((prev) => ({ ...prev, [s._id]: isFollowing }));
    }
  }

  if (loading) {
    return (
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-text">{t(locale, 'feed.suggested')}</h2>
        <div className="mt-3 flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex animate-pulse items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-surface-3" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-surface-3" />
                <div className="h-3 w-20 rounded bg-surface-3" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold text-text">
        {t(locale, 'feed.suggested')}
      </h2>
      <ul className="mt-3 flex flex-col gap-3">
        {suggestions.map((s) => {
          const isFollowing = !!following[s._id];
          const handle = s.handle ? `@${s.handle}` : '@traveler';
          return (
            <li key={s._id} className="group relative flex items-center gap-3 rounded-lg p-1 transition-colors hover:bg-surface-2">
              <Link
                href={`/profile/${s.handle ?? s._id}`}
                className="absolute inset-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={s.displayName}
              />
              <Avatar
                name={s.displayName}
                src={s.avatarUrl}
                accountType={s.accountType}
                size={40}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">
                  {s.displayName}
                </p>
                <p className="truncate text-xs text-text-muted">
                  {handle}
                  {typeof s.postCount === 'number' && s.postCount > 0
                    ? ` · ${s.postCount} ${locale === 'vi' ? 'bài viết' : 'posts'}`
                    : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant={isFollowing ? 'outline' : 'primary'}
                aria-pressed={isFollowing}
                className="relative z-10"
                onClick={(e) => { e.preventDefault(); void toggle(s); }}
              >
                {isFollowing
                  ? locale === 'vi'
                    ? 'Đang theo dõi'
                    : 'Following'
                  : locale === 'vi'
                    ? 'Theo dõi'
                    : 'Follow'}
              </Button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}