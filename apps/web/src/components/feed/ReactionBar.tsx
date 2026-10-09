'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ThumbsUp } from 'lucide-react';
import { cn } from '@/lib/cn';
import { REACTIONS, REACTION_MAP, type ReactionType } from '@/lib/reactions';

export interface ReactionBarProps {
  viewerReaction: ReactionType | null;
  /** Picking a new type, or switching from one type to another. */
  onSelect: (type: ReactionType) => void;
  /** Clicking the main button while the same type is already active. */
  onRemove: () => void;
  size?: 'sm' | 'md';
  disabled?: boolean;
}

const OPEN_DELAY = 400;
const CLOSE_DELAY = 300;
const LONG_PRESS = 400;
const MOVE_TOLERANCE = 10;

const triggerSize: Record<'sm' | 'md', string> = {
  sm: 'gap-1.5 px-2 py-1 text-[13px]',
  md: 'gap-1.5 px-2.5 py-1.5 text-sm',
};
const emojiSize: Record<'sm' | 'md', string> = {
  sm: 'text-lg',
  md: 'text-xl',
};
const pickerEmojiSize: Record<'sm' | 'md', string> = {
  sm: 'h-8 w-8 text-2xl',
  md: 'h-10 w-10 text-[28px]',
};

/**
 * Facebook-style reaction control: renders BOTH the trigger button and the
 * floating 6-emoji picker. Callers must not draw their own button.
 *
 * The picker is `absolute bottom-full`, so an ancestor with `overflow-hidden`
 * will clip it — that is the caller's card to fix, not this component's.
 */
export function ReactionBar({
  viewerReaction,
  onSelect,
  onRemove,
  size = 'md',
  disabled = false,
}: ReactionBarProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressOrigin = useRef<{ x: number; y: number } | null>(null);
  /** Set when a long-press opened the picker, so the trailing click is ignored. */
  const swallowClick = useRef(false);
  /** True when the picker was opened by keyboard, so we move focus into it. */
  const keyboardOpen = useRef(false);

  const clearTimer = (ref: React.MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
    if (ref.current) {
      clearTimeout(ref.current);
      ref.current = null;
    }
  };

  const clearAllTimers = useCallback(() => {
    clearTimer(openTimer);
    clearTimer(closeTimer);
    clearTimer(pressTimer);
  }, []);

  useEffect(() => clearAllTimers, [clearAllTimers]);

  const closePicker = useCallback(
    (returnFocus = false) => {
      clearAllTimers();
      keyboardOpen.current = false;
      // A long-press that ends off the trigger (finger slid onto an emoji, or
      // released outside) never fires the click that would consume this flag,
      // so it has to be dropped here or the user's NEXT tap gets swallowed.
      swallowClick.current = false;
      setOpen(false);
      if (returnFocus) triggerRef.current?.focus();
    },
    [clearAllTimers],
  );

  const openPicker = useCallback(
    (viaKeyboard = false) => {
      if (disabled) return;
      clearAllTimers();
      keyboardOpen.current = viaKeyboard;
      const active = viewerReaction ? REACTIONS.findIndex((r) => r.type === viewerReaction) : 0;
      setFocusIndex(active < 0 ? 0 : active);
      setOpen(true);
    },
    [clearAllTimers, disabled, viewerReaction],
  );

  // Move DOM focus with the virtual focus index while open via keyboard.
  useEffect(() => {
    if (!open || !keyboardOpen.current) return;
    itemRefs.current[focusIndex]?.focus();
  }, [open, focusIndex]);

  // Any pointer press outside the control dismisses the picker (touch + mouse).
  useEffect(() => {
    if (!open) return;
    function onDocDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) closePicker(false);
    }
    document.addEventListener('pointerdown', onDocDown);
    return () => document.removeEventListener('pointerdown', onDocDown);
  }, [open, closePicker]);

  function handlePick(type: ReactionType) {
    // Explicit as well as via closePicker: picking is a terminal action, the
    // pending long-press click must never carry over to the next tap.
    swallowClick.current = false;
    closePicker(false);
    if (type === viewerReaction) onRemove();
    else onSelect(type);
  }

  function handleTriggerClick() {
    if (disabled) return;
    if (swallowClick.current) {
      swallowClick.current = false;
      return;
    }
    closePicker(false);
    if (viewerReaction) onRemove();
    else onSelect('like');
  }

  function handleTriggerKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Stop the browser from synthesising a click: keyboard opens the picker.
      e.preventDefault();
      if (open) {
        keyboardOpen.current = true;
        itemRefs.current[focusIndex]?.focus();
      } else {
        openPicker(true);
      }
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      closePicker(true);
    }
  }

  function handleMenuKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        keyboardOpen.current = true;
        setFocusIndex((i) => (i + 1) % REACTIONS.length);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        keyboardOpen.current = true;
        setFocusIndex((i) => (i - 1 + REACTIONS.length) % REACTIONS.length);
        break;
      case 'Home':
        e.preventDefault();
        keyboardOpen.current = true;
        setFocusIndex(0);
        break;
      case 'End':
        e.preventDefault();
        keyboardOpen.current = true;
        setFocusIndex(REACTIONS.length - 1);
        break;
      case 'Escape':
        e.preventDefault();
        closePicker(true);
        break;
      case 'Tab':
        closePicker(false);
        break;
      default:
        break;
    }
  }

  // --- Desktop hover ---------------------------------------------------------
  function handlePointerEnter(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse' || disabled) return;
    clearTimer(closeTimer);
    if (open) return;
    clearTimer(openTimer);
    openTimer.current = setTimeout(() => openPicker(false), OPEN_DELAY);
  }

  function handlePointerLeave(e: React.PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== 'mouse') return;
    clearTimer(openTimer);
    clearTimer(closeTimer);
    closeTimer.current = setTimeout(() => closePicker(false), CLOSE_DELAY);
  }

  // --- Mobile long-press ----------------------------------------------------
  function handlePressStart(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.pointerType === 'mouse' || disabled) return;
    pressOrigin.current = { x: e.clientX, y: e.clientY };
    clearTimer(pressTimer);
    pressTimer.current = setTimeout(() => {
      swallowClick.current = true;
      openPicker(false);
    }, LONG_PRESS);
  }

  function handlePressMove(e: React.PointerEvent<HTMLButtonElement>) {
    const origin = pressOrigin.current;
    if (!origin || !pressTimer.current) return;
    if (
      Math.abs(e.clientX - origin.x) > MOVE_TOLERANCE ||
      Math.abs(e.clientY - origin.y) > MOVE_TOLERANCE
    ) {
      clearTimer(pressTimer);
      pressOrigin.current = null;
    }
  }

  function handlePressEnd() {
    clearTimer(pressTimer);
    pressOrigin.current = null;
  }

  const active = viewerReaction ? REACTION_MAP[viewerReaction] : null;

  return (
    <div
      ref={wrapRef}
      className="relative inline-flex"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Chọn cảm xúc"
            onKeyDown={handleMenuKeyDown}
            initial={reduce ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0, y: 8, scale: 0.9 }}
            transition={reduce ? { duration: 0 } : { duration: 0.16, ease: [0.34, 1.56, 0.64, 1] }}
            className={cn(
              'absolute bottom-full left-0 z-50 mb-2 flex items-center gap-1 rounded-full',
              'border border-border bg-surface-2 px-2 py-1.5 shadow-e3',
            )}
          >
            {REACTIONS.map((r, i) => (
              <motion.button
                key={r.type}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                type="button"
                role="menuitem"
                aria-label={r.label}
                title={r.label}
                tabIndex={i === focusIndex ? 0 : -1}
                onClick={() => handlePick(r.type)}
                onFocus={() => setFocusIndex(i)}
                initial={reduce ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.4, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : { delay: i * 0.03, type: 'spring', stiffness: 500, damping: 22 }
                }
                whileHover={reduce ? undefined : { scale: 1.35, y: -6 }}
                whileFocus={reduce ? undefined : { scale: 1.35, y: -6 }}
                className={cn(
                  'inline-flex items-center justify-center rounded-full leading-none',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  pickerEmojiSize[size],
                  viewerReaction === r.type && 'bg-surface-3',
                )}
              >
                <span aria-hidden>{r.emoji}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        onPointerDown={handlePressStart}
        onPointerMove={handlePressMove}
        onPointerUp={handlePressEnd}
        onPointerCancel={handlePressEnd}
        className={cn(
          'inline-flex select-none items-center rounded-full font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          'disabled:pointer-events-none disabled:opacity-60',
          triggerSize[size],
          active ? 'font-semibold' : 'text-text-muted hover:text-text hover:bg-surface-2',
        )}
        style={active ? { color: active.color } : undefined}
      >
        {active ? (
          <motion.span
            key={active.type}
            className={cn('leading-none', emojiSize[size])}
            initial={reduce ? false : { scale: 0.5 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            aria-hidden
          >
            {active.emoji}
          </motion.span>
        ) : (
          <ThumbsUp size={size === 'sm' ? 16 : 18} aria-hidden />
        )}
        {active ? active.label : 'Thích'}
      </button>
    </div>
  );
}
