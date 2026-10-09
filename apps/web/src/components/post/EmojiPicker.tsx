'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Smile } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Locale } from '@/lib/i18n';

/**
 * Grouped Unicode emoji picker (contract part 2 §4.5).
 *
 * No dependency, no sprite sheet, no network: every entry is a literal Unicode
 * codepoint the platform font already renders. The component owns its trigger so
 * the outside-`pointerdown` dismissal can test containment on a single wrapper —
 * the same shape `ReactionBar` uses, which handles touch and mouse alike.
 *
 * The popover is positioned `absolute bottom-full`. Do NOT wrap this (or any
 * ancestor) in `overflow-hidden` — that clips floating popovers, a bug Phase 1
 * already paid for once.
 */

interface EmojiGroup {
  id: string;
  /** Tab label, vi / en. */
  label: [string, string];
  emojis: string[];
}

const GROUPS: EmojiGroup[] = [
  {
    id: 'smileys',
    label: ['Cảm xúc', 'Smileys'],
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '😉', '😊', '😇', '🥰', '😍', '😘', '😗',
      '😋', '😜', '🤪', '🤗', '🤔', '🤨', '😐', '😴',
      '😌', '😔', '😪', '😫', '🥱', '😢', '😭', '😤',
      '😠', '🤯', '😳', '🥺', '😬', '🙄', '😮', '😱',
    ],
  },
  {
    id: 'gestures',
    label: ['Cử chỉ', 'Gestures'],
    emojis: [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤙', '👋',
      '🙌', '👏', '🙏', '💪', '🫶', '❤️', '🧡', '💛',
      '💚', '💙', '💜', '🖤', '💔', '💯', '🔥', '⭐',
    ],
  },
  {
    id: 'travel',
    label: ['Du lịch', 'Travel'],
    emojis: [
      '✈️', '🚆', '🚌', '🛵', '🚲', '⛵', '🚤', '🧳',
      '🎒', '🗺️', '🧭', '🏖️', '🏝️', '⛰️', '🏕️', '🌋',
      '🗿', '🏛️', '🎡', '🎢', '📷', '🌅', '🌄', '🌈',
    ],
  },
  {
    id: 'food',
    label: ['Ăn uống', 'Food'],
    emojis: [
      '🍜', '🍚', '🍲', '🥘', '🥖', '🥟', '🍢', '🍤',
      '🦐', '🦀', '🐟', '🍉', '🥭', '🍌', '🥥', '🍍',
      '☕', '🍵', '🧋', '🍺', '🍻', '🥂', '🍦', '🎂',
    ],
  },
  {
    id: 'nature',
    label: ['Thiên nhiên', 'Nature'],
    emojis: [
      '🌸', '🌼', '🌻', '🌺', '🌴', '🌵', '🍀', '🍃',
      '🌊', '☀️', '🌙', '☁️', '🌧️', '⚡', '❄️', '🌟',
      '🐶', '🐱', '🐢', '🦋', '🐝', '🐠', '🦜', '🐘',
    ],
  },
];

export interface EmojiPickerProps {
  /** Called with the chosen Unicode character. The composer splices it at the caret. */
  onSelect: (emoji: string) => void;
  disabled?: boolean;
  locale?: Locale;
  /** Matches the composer's action-button sizing. */
  size?: 'sm' | 'md';
}

export function EmojiPicker({
  onSelect,
  disabled = false,
  locale = 'vi',
  size = 'md',
}: EmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState(GROUPS[0].id);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const label = locale === 'vi' ? 'Chèn biểu tượng cảm xúc' : 'Insert emoji';

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // Any pointer press outside the control dismisses the popover (touch + mouse).
  useEffect(() => {
    if (!open) return;
    function onDocDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) close(false);
    }
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [open, close]);

  const active = GROUPS.find((g) => g.id === group) ?? GROUPS[0];
  const btn = size === 'sm' ? 'h-7 w-7' : 'h-9 w-9';
  const icon = size === 'sm' ? 16 : 18;

  return (
    <div ref={wrapRef} className="relative inline-flex">
      {open && (
        <div
          role="dialog"
          aria-label={locale === 'vi' ? 'Bảng biểu tượng cảm xúc' : 'Emoji panel'}
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
            aria-label={locale === 'vi' ? 'Nhóm biểu tượng' : 'Emoji groups'}
            className="mb-2 flex gap-1"
          >
            {GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                role="tab"
                aria-selected={g.id === group}
                onClick={() => setGroup(g.id)}
                className={cn(
                  'flex-1 truncate rounded-lg px-1.5 py-1 text-[11px] font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  g.id === group
                    ? 'bg-surface-3 text-text'
                    : 'text-text-muted hover:bg-surface-3 hover:text-text',
                )}
              >
                {locale === 'vi' ? g.label[0] : g.label[1]}
              </button>
            ))}
          </div>

          <div
            className="grid max-h-[184px] grid-cols-8 gap-0.5 overflow-y-auto"
            role="group"
            aria-label={locale === 'vi' ? active.label[0] : active.label[1]}
          >
            {active.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={emoji}
                title={emoji}
                onClick={() => onSelect(emoji)}
                className={cn(
                  'inline-flex h-8 w-8 items-center justify-center rounded-lg text-xl leading-none',
                  'transition-transform hover:scale-125 hover:bg-surface-3',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <span aria-hidden>{emoji}</span>
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
        <Smile size={icon} aria-hidden />
      </button>
    </div>
  );
}
