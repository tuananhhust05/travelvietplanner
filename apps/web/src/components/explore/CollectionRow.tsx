'use client';

import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/cn';

export interface CollectionItem {
  id: string;
  name: string;
  meta: string;
  gradient: string;
  /** Optional place slug — when present the item deep-links to /places/{slug}. */
  slug?: string;
}

export interface CollectionRowProps {
  title: string;
  subtitle: string;
  items: CollectionItem[];
  className?: string;
}

export function CollectionRow({ title, subtitle, items, className }: CollectionRowProps) {
  return (
    <section className={cn('space-y-3', className)} aria-label={title}>
      <header className="flex items-end justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-text text-balance">{title}</h3>
          <p className="text-sm text-text-muted text-pretty">{subtitle}</p>
        </div>
        <a
          href="/explore"
          className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg rounded-lg"
        >
          Xem tất cả
          <ArrowRight size={15} aria-hidden />
        </a>
      </header>

      <div
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:-mx-6 md:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {items.map((item) => (
          <a
            key={item.id}
            href={item.slug ? `/places/${item.slug}` : '/explore'}
            role="listitem"
            className={cn(
              'group relative flex h-44 w-64 shrink-0 snap-start flex-col justify-end overflow-hidden rounded-2xl border border-border p-4',
              'shadow-e2 transition-transform duration-base ease-standard hover:-translate-y-1 hover:shadow-e3',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
            )}
          >
            <span
              aria-hidden
              className={cn('absolute inset-0 -z-10 bg-gradient-to-br', item.gradient)}
            />
            <span
              aria-hidden
              className="absolute inset-0 -z-10 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
            />
            <Badge className="mb-2 w-fit bg-black/40 text-white backdrop-blur-sm">
              {item.meta}
            </Badge>
            <h4 className="text-base font-semibold text-white text-balance">{item.name}</h4>
          </a>
        ))}
      </div>
    </section>
  );
}
