'use client';

import { Fragment, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { MapPin, Lightbulb, Navigation } from 'lucide-react';
import {
  parseRichText,
  trimPartialMarkers,
  type InlineToken,
  type RichBlock,
} from '@/lib/richText';
import { cn } from '@/lib/cn';

function Caret() {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[0.15em] rounded-full bg-current align-baseline"
      animate={reduce ? { opacity: 1 } : { opacity: [1, 0.15, 1] }}
      transition={reduce ? undefined : { duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}

function Inline({ tokens, caret }: { tokens: InlineToken[]; caret?: boolean }) {
  return (
    <>
      {tokens.map((tk, i) => {
        if (tk.type === 'strong') {
          return (
            <strong key={i} className="font-semibold text-text">
              {tk.value}
            </strong>
          );
        }
        if (tk.type === 'code') {
          return (
            <code
              key={i}
              className="rounded-md border border-border bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]"
            >
              {tk.value}
            </code>
          );
        }
        return <Fragment key={i}>{tk.value}</Fragment>;
      })}
      {caret && <Caret />}
    </>
  );
}

function OrderBadge({ value }: { value: string }) {
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-[11px] font-bold text-primary"
    >
      {value}
    </span>
  );
}

// A named place with an address becomes a card: the name is the thing the user
// scans for, the address is the thing they act on.
function PoiCard({
  name,
  address,
  note,
  caret,
}: {
  name: string;
  address?: string;
  note: InlineToken[];
  caret?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 28 }}
      className={cn(
        'flex gap-3 rounded-xl border border-border bg-surface-1 p-3',
        'transition-[border-color,background] duration-base hover:border-primary/40 hover:bg-primary/5',
      )}
    >
      <span
        aria-hidden
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary"
      >
        <MapPin className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-text text-pretty">{name}</p>
        {address && (
          <p className="mt-1 inline-flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
            <Navigation className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{address}</span>
          </p>
        )}
        {note.length > 0 && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted text-pretty">
            <Inline tokens={note} caret={caret} />
          </p>
        )}
      </div>
    </motion.div>
  );
}

function Block({ block, caret }: { block: RichBlock; caret?: boolean }) {
  switch (block.kind) {
    case 'heading':
      return (
        <div className="flex items-center gap-2 pt-1">
          {block.order && <OrderBadge value={block.order} />}
          <h4 className="text-[15px] font-semibold leading-snug text-text text-balance">
            {block.title}
            {block.sub && (
              <span className="ml-1.5 align-middle text-[11px] font-medium uppercase tracking-wide text-text-muted">
                {block.sub}
              </span>
            )}
            {caret && <Caret />}
          </h4>
        </div>
      );

    case 'poi':
      return <PoiCard name={block.name} address={block.address} note={block.note} caret={caret} />;

    case 'labeled':
      return (
        <div className="flex gap-2.5 rounded-xl border border-border/70 bg-surface-1 px-3 py-2">
          <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <p className="min-w-0 text-[13px] leading-relaxed text-text-muted text-pretty">
            <span className="font-semibold text-text">{block.label}</span>
            {block.note.length > 0 && ' — '}
            <Inline tokens={block.note} caret={caret} />
          </p>
        </div>
      );

    case 'bullet':
      return (
        <div className="flex gap-2.5">
          <span
            aria-hidden
            className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50 ring-2 ring-primary/15"
          />
          <p className="min-w-0 text-[13px] leading-relaxed text-text text-pretty">
            <Inline tokens={block.note} caret={caret} />
          </p>
        </div>
      );

    case 'numbered':
      return (
        <div className="flex gap-2.5">
          <OrderBadge value={block.order} />
          <p className="min-w-0 pt-0.5 text-[13px] leading-relaxed text-text text-pretty">
            <Inline tokens={block.note} caret={caret} />
          </p>
        </div>
      );

    case 'callout':
      return (
        <div className="rounded-xl border border-accent/30 bg-accent/[0.07] p-3">
          <p className="flex items-center gap-2 text-[13px] font-semibold text-accent">
            <Lightbulb className="h-4 w-4 shrink-0" aria-hidden />
            {block.title.replace(/^[\p{Extended_Pictographic}️\s]+/u, '')}
          </p>
          <div className="mt-2 space-y-1.5">
            {block.items.map((item, i) => (
              <Block key={i} block={item} caret={caret && i === block.items.length - 1} />
            ))}
          </div>
        </div>
      );

    default:
      return (
        <p className="text-sm leading-relaxed text-text text-pretty">
          <Inline tokens={block.note} caret={caret} />
        </p>
      );
  }
}

export function RichMessage({ content, streaming }: { content: string; streaming?: boolean }) {
  const blocks = useMemo(
    () => parseRichText(streaming ? trimPartialMarkers(content) : content),
    [content, streaming],
  );

  if (blocks.length === 0) {
    return streaming ? <Caret /> : null;
  }

  return (
    <div className="space-y-2">
      {blocks.map((b, i) => (
        <Block key={i} block={b} caret={streaming && i === blocks.length - 1} />
      ))}
    </div>
  );
}
