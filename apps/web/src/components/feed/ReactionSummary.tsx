'use client';

import { cn } from '@/lib/cn';
import {
  REACTION_MAP,
  formatCount,
  normalizeCounts,
  normalizeTotal,
  topReactions,
  type ReactionCounts,
} from '@/lib/reactions';

export interface ReactionSummaryProps {
  counts: ReactionCounts;
  total: number;
  onOpenList: () => void;
  className?: string;
}

/**
 * Overlapping top-3 emoji cluster + total. Opens the reaction list on click.
 * Renders nothing when nobody has reacted.
 */
export function ReactionSummary({ counts, total, onOpenList, className }: ReactionSummaryProps) {
  const safeTotal = normalizeTotal(total);
  if (safeTotal === 0) return null;

  const safeCounts = normalizeCounts(counts);
  const top = topReactions(safeCounts, 3);

  return (
    <button
      type="button"
      onClick={onOpenList}
      aria-label={`Xem ${safeTotal} người đã bày tỏ cảm xúc`}
      className={cn(
        'group inline-flex items-center gap-1.5 rounded-full py-0.5 text-sm text-text-muted',
        'transition-colors hover:text-text',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <span className="inline-flex items-center">
        {top.map((type, i) => (
          <span
            key={type}
            aria-hidden
            className={cn(
              'inline-flex h-5 w-5 items-center justify-center rounded-full',
              'bg-surface-1 text-[13px] leading-none ring-2 ring-surface-1',
              i > 0 && '-ml-1.5',
            )}
            // Earlier (higher count) emoji stays on top of the ones after it.
            style={{ zIndex: top.length - i }}
          >
            {REACTION_MAP[type].emoji}
          </span>
        ))}
      </span>
      <span className="font-medium tabular-nums group-hover:underline">
        {formatCount(safeTotal)}
      </span>
    </button>
  );
}
