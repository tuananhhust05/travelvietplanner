'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties, RefObject, SyntheticEvent } from 'react';

const VIEWPORT_MARGIN = 8;
/** Below this, a side is considered too cramped to be worth opening into. */
const MIN_USABLE_HEIGHT = 120;

// useLayoutEffect warns during SSR; the menu never renders on the server anyway.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export type MenuPlacement = 'top' | 'bottom';

export interface AnchoredMenuOptions {
  /** 'end' aligns the menu's right edge to the trigger's right edge. */
  align?: 'start' | 'end';
  /** Space between trigger and menu, in px. */
  gap?: number;
  /** Force the menu to the trigger's width (for combobox-style inputs). */
  matchWidth?: boolean;
  minWidth?: number;
  /** Upper bound on height, on top of the available-space bound. */
  maxHeight?: number;
  /** Notified when the menu opens or closes, including on outside click / Escape. */
  onOpenChange?: (open: boolean) => void;
}

export interface AnchoredMenu<T extends HTMLElement> {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: (e?: SyntheticEvent) => void;
  close: () => void;
  /** False until after hydration — gate createPortal on this. */
  mounted: boolean;
  /** Re-measure and re-place. Call when the menu's content changes while open. */
  reposition: () => void;
  placement: MenuPlacement;
  style: CSSProperties;
  triggerRef: RefObject<T>;
  menuRef: RefObject<HTMLDivElement>;
}

/**
 * Anchors a floating menu to a trigger using fixed positioning, flipping it
 * above the trigger when there is not enough room below so options never end up
 * clipped off-screen. Pair with createPortal(document.body) to escape any
 * overflow/transform ancestors.
 */
export function useAnchoredMenu<T extends HTMLElement = HTMLButtonElement>(
  options: AnchoredMenuOptions = {},
): AnchoredMenu<T> {
  const { align = 'end', gap = 6, matchWidth = false, minWidth, maxHeight, onOpenChange } = options;

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [placement, setPlacement] = useState<MenuPlacement>('bottom');
  const [style, setStyle] = useState<CSSProperties>({
    position: 'fixed',
    top: 0,
    left: 0,
    visibility: 'hidden',
  });

  const triggerRef = useRef<T | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  // Notify from an effect rather than inside setOpen so callers that own the
  // open state (e.g. a search field) can sync back without an update loop.
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const notifiedRef = useRef(open);
  useEffect(() => {
    if (notifiedRef.current === open) return;
    notifiedRef.current = open;
    onOpenChangeRef.current?.(open);
  }, [open]);

  const position = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;

    const r = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const width = matchWidth ? r.width : Math.max(menu.offsetWidth, minWidth ?? 0);
    // maxHeight is border-box but scrollHeight is not, so the borders have to be
    // added back or content that exactly fits still gets a scrollbar.
    const chrome = menu.offsetHeight - menu.clientHeight;
    const natural = menu.scrollHeight + chrome;
    const roomBelow = vh - r.bottom - gap - VIEWPORT_MARGIN;
    const roomAbove = r.top - gap - VIEWPORT_MARGIN;

    // Flip up only when below can't fit the menu and above has more room.
    const flip = natural > roomBelow && roomAbove > roomBelow;
    const room = Math.max(MIN_USABLE_HEIGHT, flip ? roomAbove : roomBelow);
    const height = Math.min(natural, room, maxHeight ?? Number.POSITIVE_INFINITY);

    let left = align === 'end' ? r.right - width : r.left;
    left = Math.min(Math.max(VIEWPORT_MARGIN, left), Math.max(VIEWPORT_MARGIN, vw - width - VIEWPORT_MARGIN));

    // Clamp for viewports too short to honour the anchor on either side.
    const rawTop = flip ? r.top - gap - height : r.bottom + gap;
    const top = Math.min(Math.max(VIEWPORT_MARGIN, rawTop), Math.max(VIEWPORT_MARGIN, vh - height - VIEWPORT_MARGIN));

    setPlacement(flip ? 'top' : 'bottom');
    setStyle({
      position: 'fixed',
      top,
      left,
      width: matchWidth ? width : undefined,
      minWidth,
      maxHeight: height,
      zIndex: 9999,
      visibility: 'visible',
    });
  }, [align, gap, matchWidth, minWidth, maxHeight]);

  // Runs before paint, so the menu is measured and placed in the same frame it
  // becomes visible — no jump from a provisional position.
  useIsoLayoutEffect(() => {
    if (open) position();
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    function reflow() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      // Trigger scrolled out of view: nothing to anchor to.
      if (r.bottom < 0 || r.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      position();
    }
    window.addEventListener('resize', reflow);
    window.addEventListener('scroll', reflow, true);
    return () => {
      window.removeEventListener('resize', reflow);
      window.removeEventListener('scroll', reflow, true);
    };
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggle = useCallback((e?: SyntheticEvent) => {
    e?.stopPropagation();
    setOpen((v) => !v);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  return { open, setOpen, toggle, close, mounted, reposition: position, placement, style, triggerRef, menuRef };
}
