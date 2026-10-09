'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { ExternalLink, BookMarked } from 'lucide-react';
import { cn } from '@/lib/cn';

export interface Citation {
  id: string;
  title: string;
  source: string;
  url?: string;
}

export function CitationChip({ citation, index = 0 }: { citation: Citation; index?: number }) {
  const reduce = useReducedMotion();
  const Tag = citation.url ? motion.a : motion.span;

  return (
    <Tag
      {...(citation.url
        ? { href: citation.url, target: '_blank', rel: 'noreferrer' }
        : {})}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
      animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1 }}
      transition={
        reduce
          ? { duration: 0.12 }
          : { type: 'spring', stiffness: 520, damping: 22, delay: index * 0.05 }
      }
      className={cn(
        'group inline-flex max-w-[16rem] items-center gap-1.5 rounded-full border px-2.5 py-1',
        'border-primary/30 bg-primary/10 text-xs font-medium text-primary',
        'transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        citation.url && 'hover:bg-primary/20',
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] tabular-nums">
        {citation.url ? (
          <BookMarked className="h-2.5 w-2.5" aria-hidden />
        ) : (
          index + 1
        )}
      </span>
      <span className="truncate">{citation.title}</span>
      <span className="shrink-0 text-primary/60">· {citation.source}</span>
      {citation.url && (
        <ExternalLink
          className="h-3 w-3 shrink-0 opacity-60 transition-opacity group-hover:opacity-100"
          aria-hidden
        />
      )}
    </Tag>
  );
}
