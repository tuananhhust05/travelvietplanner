import { forwardRef, useEffect, useRef } from 'react';
import { cn } from '@/lib/cn';

const base =
  'w-full rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-[15px] text-text placeholder:text-text-muted ' +
  'transition-[border,box-shadow] duration-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
  'disabled:opacity-60';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(base, className)} {...props} />;
  },
);

const DEFAULT_MAX_HEIGHT = 320;

/**
 * Grow to fit the content, but stop at `maxHeight` and scroll from there.
 *
 * Two details that are easy to get wrong: `scrollHeight` excludes the border while
 * `height` under `box-sizing: border-box` includes it, so the border has to be added
 * back or the last line sits clipped behind the bottom edge. And overflow must be
 * forced off before measuring, because a scrollbar left over from a previous, longer
 * value makes the element report its own scrolled state rather than the new content.
 */
function autoResize(el: HTMLTextAreaElement, maxHeight: number) {
  el.style.height = 'auto';
  el.style.overflowY = 'hidden';
  const border = el.offsetHeight - el.clientHeight;
  const needed = el.scrollHeight + border;
  el.style.height = `${Math.min(needed, maxHeight)}px`;
  el.style.overflowY = needed > maxHeight ? 'auto' : 'hidden';
}

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Height at which growing stops and the field scrolls internally. */
  maxHeight?: number;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, onChange, maxHeight = DEFAULT_MAX_HEIGHT, ...props },
  ref,
) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  const setRef = (el: HTMLTextAreaElement | null) => {
    innerRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
  };

  useEffect(() => {
    if (innerRef.current) autoResize(innerRef.current, maxHeight);
  }, [props.value, maxHeight]);

  // Narrowing the field rewraps the text and needs more rows than the last measure
  // assumed — window resize, device rotation, or a sidebar opening beside the form.
  useEffect(() => {
    const el = innerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let lastWidth = el.clientWidth;
    const ro = new ResizeObserver(() => {
      if (el.clientWidth === lastWidth) return;
      lastWidth = el.clientWidth;
      autoResize(el, maxHeight);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxHeight]);

  return (
    <textarea
      ref={setRef}
      className={cn(base, 'field-scroll resize-none min-h-[120px] overflow-hidden', className)}
      onChange={(e) => {
        autoResize(e.target, maxHeight);
        onChange?.(e);
      }}
      {...props}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  return <select ref={ref} className={cn(base, 'cursor-pointer', className)} {...props} />;
});
