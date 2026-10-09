'use client';

import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAnchoredMenu } from '@/hooks/useAnchoredMenu';

export type BookingStatus = 'new' | 'contacted' | 'quoted' | 'won' | 'lost' | 'spam';

export const STATUS_META: Record<BookingStatus, { label: string; cls: string; dot: string }> = {
  new:       { label: 'Mới',        cls: 'bg-info/15 text-info ring-1 ring-info/30',           dot: 'bg-info' },
  contacted: { label: 'Đã liên hệ', cls: 'bg-warning/15 text-warning ring-1 ring-warning/30',  dot: 'bg-warning' },
  quoted:    { label: 'Đã báo giá', cls: 'bg-primary/15 text-primary ring-1 ring-primary/30',  dot: 'bg-primary' },
  won:       { label: 'Thành công', cls: 'bg-success/15 text-success ring-1 ring-success/30',  dot: 'bg-success' },
  lost:      { label: 'Thất bại',   cls: 'bg-danger/15 text-danger ring-1 ring-danger/30',     dot: 'bg-danger' },
  spam:      { label: 'Spam',       cls: 'bg-surface-2 text-text-muted ring-1 ring-border',    dot: 'bg-text-muted' },
};

export const STATUS_ACCENT: Record<BookingStatus, string> = {
  new:       'border-l-info',
  contacted: 'border-l-warning',
  quoted:    'border-l-primary',
  won:       'border-l-success',
  lost:      'border-l-danger',
  spam:      'border-l-border',
};

export function statusMeta(status: string) {
  return STATUS_META[status as BookingStatus] ?? STATUS_META.new;
}

export interface StatusSelectProps {
  value: string;
  onChange: (v: BookingStatus) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

/**
 * Status picker for a booking. The option list is portalled and anchored, so it
 * flips above the trigger near the bottom of the viewport instead of being
 * clipped — bookings are rows in a long list, so the trigger is often low.
 */
export function StatusSelect({ value, onChange, disabled, size = 'sm' }: StatusSelectProps) {
  const menu = useAnchoredMenu<HTMLButtonElement>({ align: 'end', minWidth: 156 });
  const meta = statusMeta(value);
  const offsetY = menu.placement === 'top' ? 4 : -4;

  const panel = (
    <AnimatePresence>
      {menu.open && (
        <motion.div
          ref={menu.menuRef}
          role="listbox"
          aria-label="Trạng thái yêu cầu"
          initial={{ opacity: 0, scale: 0.96, y: offsetY }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: offsetY }}
          transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
          style={menu.style}
          className="overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-1 py-1 shadow-e3"
        >
          {(Object.keys(STATUS_META) as BookingStatus[]).map((key) => {
            const m = STATUS_META[key];
            const active = key === value;
            return (
              <button
                key={key}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(key);
                  menu.close();
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-xs font-medium transition-colors duration-base',
                  active ? 'bg-surface-2 text-text' : 'text-text-muted hover:bg-surface-2 hover:text-text',
                )}
              >
                <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', m.dot)} />
                <span className="flex-1">{m.label}</span>
                {active && <Check size={12} className="shrink-0 text-primary" />}
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <button
        ref={menu.triggerRef}
        type="button"
        disabled={disabled}
        onClick={menu.toggle}
        aria-haspopup="listbox"
        aria-expanded={menu.open}
        className={cn(
          'flex cursor-pointer items-center rounded-lg border border-border bg-surface-2 font-medium text-text transition-colors duration-base hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          size === 'md' ? 'gap-2 px-4 py-2 text-sm' : 'gap-1.5 px-2.5 py-1.5 text-xs',
        )}
      >
        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
        <span>{meta.label}</span>
        <ChevronDown
          size={size === 'md' ? 14 : 12}
          className={cn(
            'shrink-0 text-text-muted transition-transform duration-base',
            menu.open && 'rotate-180',
          )}
        />
      </button>
      {menu.mounted && createPortal(panel, document.body)}
    </>
  );
}
