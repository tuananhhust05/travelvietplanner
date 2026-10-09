'use client';

import Link from 'next/link';
import Image from 'next/image';
import { MapPin, User } from 'lucide-react';
import type { SearchPostResult } from '@/lib/api';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}p`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function PostResult({ post }: { post: SearchPostResult }) {
  const excerpt = post.body.length > 120 ? post.body.slice(0, 120) + '…' : post.body;
  const locationLabel = post.address?.label ?? post.place?.name;

  return (
    <Link
      href={`/posts/${post.id}`}
      className="block rounded-xl border border-border bg-surface-1 p-3 hover:bg-surface-2 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full bg-surface-3">
          {post.author?.avatarUrl ? (
            <Image
              src={post.author.avatarUrl}
              alt={post.author.displayName ?? ''}
              fill
              className="object-cover"
            />
          ) : (
            <User size={14} className="absolute inset-0 m-auto text-text-muted" />
          )}
        </div>
        <span className="text-xs text-text-muted">
          {post.author?.displayName ?? 'Unknown'} · {timeAgo(post.createdAt)}
        </span>
      </div>
      <p className="text-sm text-text leading-snug">{excerpt}</p>
      {locationLabel && (
        <div className="mt-1 flex items-center gap-1 text-xs text-text-muted">
          <MapPin size={11} />
          <span>{locationLabel}</span>
        </div>
      )}
    </Link>
  );
}
