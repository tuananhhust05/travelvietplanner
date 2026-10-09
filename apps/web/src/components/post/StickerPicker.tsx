'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Sticker as StickerIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { STICKER_PACKS } from '@/lib/stickers';
import type { Locale } from '@/lib/i18n';

/**
 * Pack tabs + glyph grid (contract part 2 §3).
 *
 * Stickers are curated Unicode glyphs, so the grid is pure text — no images, no
 * preloading, nothing that can 404. `onSelect` hands back the namespaced catalogue
 * id (`travel.plane`); the composer turns that into `{kind:'sticker', stickerId}`
 * with NO url, which is what the API validates against its own copy of the
 * catalogue.
 *
 * Dismissal copies `ReactionBar`'s document-level `pointerdown` listener (touch +
 * mouse). The panel floats `absolute bottom-full`, so no ancestor may be
 * `overflow-hidden`.
 */

export interface StickerPickerProps {
  /** Called with the sticker's catalogue id, e.g. `travel.plane`. */
  onSelect: (stickerId: string) => void;
  disabled?: boolean;
  locale?: Locale;
  size?: 'sm' | 'md';
}

export function StickerPicker({
  onSelect,
  disabled = false,
  locale = 'vi',
  size = 'md',
}: StickerPickerProps) {
  const [open, setOpen] = useState(false);
  const [packId, setPackId] = useState(STICKER_PACKS[0]?.id ?? '');
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const label = locale === 'vi' ? 'Chèn nhãn dán' : 'Insert sticker';

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDocDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) close(false);
    }
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [open, close]);

  const pack = STICKER_PACKS.find((p) => p.id === packId) ?? STICKER_PACKS[0];
  const btn = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const icon = size === 'sm' ? 16 : 18;

  return (
    <div ref={wrapRef} className="relative inline-flex">
      {open && pack && (
        <div
          role="dialog"
          aria-label={locale === 'vi' ? 'Bảng nhãn dán' : 'Sticker panel'}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              close(true);
            }
          }}
          className={cn(
            'absolute bottom-full left-0 z-50 mb-2 w-[286px] rounded-2xl',
            'border border-border bg-surface-2 p-2 shadow-e3',
          )}
        >
          <div
            role="tablist"
            aria-label={locale === 'vi' ? 'Bộ nhãn dán' : 'Sticker packs'}
            className="mb-2 flex gap-1"
          >
            {STICKER_PACKS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={p.id === pack.id}
                onClick={() => setPackId(p.id)}
                className={cn(
                  'flex-1 truncate rounded-lg px-1.5 py-1 text-[11px] font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  p.id === pack.id
                    ? 'bg-surface-3 text-text'
                    : 'text-text-muted hover:bg-surface-3 hover:text-text',
                )}
              >
                {p.name}
              </button>
            ))}
          </div>

          <div
            className="grid max-h-[200px] grid-cols-4 gap-1 overflow-y-auto"
            role="group"
            aria-label={pack.name}
          >
            {pack.stickers.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-label={s.label}
                title={s.label}
                onClick={() => {
                  onSelect(s.id);
                  close(false);
                }}
                className={cn(
                  'inline-flex h-14 items-center justify-center rounded-xl text-3xl leading-none',
                  'transition-transform hover:scale-110 hover:bg-surface-3',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <span aria-hidden>{s.glyph}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => (open ? close(false) : setOpen(true))}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.preventDefault();
            close(true);
          }
        }}
        className={cn(
          'inline-flex items-center justify-center rounded-lg text-text-muted transition-colors',
          'hover:bg-surface-2 hover:text-text',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-40',
          btn,
          open && 'bg-surface-2 text-text',
        )}
      >
        <StickerIcon size={icon} aria-hidden />
      </button>
    </div>
  );
}
