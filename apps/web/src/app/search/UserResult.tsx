'use client';

import Link from 'next/link';
import Image from 'next/image';
import { User } from 'lucide-react';
import type { SearchUserResult } from '@/lib/api';

export function UserResult({ user }: { user: SearchUserResult }) {
  return (
    <Link
      href={`/profile/${user.handle}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-surface-1 p-3 hover:bg-surface-2 transition-colors"
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-3">
        {user.avatarUrl ? (
          <Image src={user.avatarUrl} alt={user.displayName} fill className="object-cover" />
        ) : (
          <User size={20} className="absolute inset-0 m-auto text-text-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">{user.displayName}</p>
        <p className="truncate text-xs text-text-muted">@{user.handle}</p>
      </div>
      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-muted capitalize">
        {user.accountType}
      </span>
    </Link>
  );
}
